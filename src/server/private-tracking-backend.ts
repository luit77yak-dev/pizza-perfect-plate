import { serverConfiguration, gateHostedRpc } from "./hosted-release-core.mjs";
import { createHmac } from "node:crypto";
import type { TrackingDependencies } from "./private-tracking.ts";

type Environment = Record<string, string | undefined>;
export type TrackingRpc = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{
    data: unknown;
    error: { code?: string } | null;
  }>;
};

/** Hosted activation requires separately pinned authority; default trust is closed. */
export function privateTrackingConfiguration(
  env: Environment,
): { domains: string[]; secret: string } | null {
  if (env["NEROXA_BACKEND_MODE"] === "hosted-release") {
    if (env["NEROXA_PRIVATE_TRACKING_ENABLED"] !== "true") return null;
    try { const config = serverConfiguration(env); return {domains: [...config.domains], secret: config.secret}; } catch { return null; }
  }
  if (
    env["NEROXA_PRIVATE_TRACKING_ENABLED"] !== "true" ||
    env["NEROXA_BACKEND_MODE"] !== "homologation" ||
    env["NEROXA_TEST_PROJECT_REF"] !== "local-disposable" ||
    env["NEROXA_TRACKING_PROXY_CONTRACT"] !== "direct-canonical-host-v1"
  )
    return null;
  try {
    const backend = new URL(env["SUPABASE_URL"] ?? "");
    if (
      backend.protocol !== "http:" ||
      backend.hostname !== "127.0.0.1" ||
      !backend.port ||
      backend.username ||
      backend.password ||
      backend.search ||
      backend.hash ||
      backend.pathname !== "/" ||
      env["NEROXA_DELIVERY_BACKEND_URL"] !== backend.origin
    )
      return null;
    const domains = (env["NEROXA_TRACKING_CANONICAL_DOMAINS"] ?? "").split(",");
    if (
      !domains.length ||
      domains.some((domain) => !/^[a-z0-9-]+[.]synthetic[.]invalid$/.test(domain)) ||
      new Set(domains).size !== domains.length
    )
      return null;
    const secret = env["NEROXA_TRACKING_QUOTA_SECRET"] ?? "";
    if (Buffer.byteLength(secret, "utf8") < 32) return null;
    return { domains, secret };
  } catch {
    return null;
  }
}

/** Same RPC adapter used by the server route and disposable real-REST tests. */
export function privateTrackingDependencies(
  env: Environment,
  backend: TrackingRpc,
): TrackingDependencies {
  backend = gateHostedRpc(env, backend);
  const config = privateTrackingConfiguration(env);
  return {
    enabled: config !== null,
    canonicalDomains: config?.domains ?? [],
    reserveIngress: async (request) => {
      if (!config) return false;
      // Per-canonical-domain global ingress budget. No untrusted client IP/forwarded header.
      const fingerprint = createHmac("sha256", config.secret)
        .update("tracking-ingress:v1:" + new URL(request.url).hostname)
        .digest("hex");
      const result = await backend.rpc("neroxa_tracking_reserve_ingress", {
        p_fingerprint: fingerprint,
      });
      return !result.error && result.data === true;
    },
    resolveContext: async (domain) => {
      if (!config?.domains.includes(domain)) return null;
      const result = await backend.rpc("get_public_storefront_context", { p_domain: domain });
      if (result.error) return null;
      const row = (Array.isArray(result.data) ? result.data[0] : result.data) as Record<
        string,
        unknown
      > | null;
      if (!row || row["domain"] !== domain || typeof row["instance_id"] !== "string") return null;
      return { domain, instance_id: row["instance_id"] };
    },
    track: async (context, orderId, token) => {
      if (!config?.domains.includes(context.domain)) throw new Error("Tracking unavailable");
      const result = await backend.rpc("neroxa_track_order_with_capability", {
        p_instance_id: context.instance_id,
        p_order_id: orderId,
        p_token: token,
      });
      if (result.error) throw new Error("Tracking unavailable");
      return result.data;
    },
  };
}
