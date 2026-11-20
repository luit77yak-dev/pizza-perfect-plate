import { readBoundedJson } from "./bounded-json.ts";

export type TrackingContext = { instance_id: string; domain: string };
export type TrackingDependencies = {
  enabled: boolean;
  /** Exact canonical domains from trusted server configuration; never forwarded headers. */
  canonicalDomains: readonly string[];
  /** Durable, atomic ingress quota keyed by deployment's trusted connection identity. */
  reserveIngress: (request: Request) => Promise<boolean>;
  resolveContext: (domain: string) => Promise<TrackingContext | null>;
  track: (context: TrackingContext, orderId: string, token: string) => Promise<unknown>;
};
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const headers = {
  "Cache-Control": "no-store, private",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  Vary: "Origin",
};
/** Explicit allowlist projection: backend additions must not leak PII through this boundary. */
export function trackingProjection(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    !UUID.test(String(row["order_id"])) ||
    typeof row["status"] !== "string" ||
    !Number.isFinite(Number(row["total"])) ||
    Number(row["total"]) < 0 ||
    !Array.isArray(row["items"])
  )
    return null;
  const items = row["items"].map((entry: unknown) => {
    if (!entry || typeof entry !== "object") return null;
    const item = entry as Record<string, unknown>;
    if (
      typeof item["name"] !== "string" ||
      item["name"].length > 200 ||
      !Number.isSafeInteger(item["quantity"]) ||
      Number(item["quantity"]) < 1 ||
      !Number.isFinite(Number(item["line_total"])) ||
      Number(item["line_total"]) < 0
    )
      return null;
    return {
      name: item["name"],
      quantity: item["quantity"],
      line_total: Number(item["line_total"]),
    };
  });
  if (items.some((item) => item === null)) return null;
  return { order_id: row["order_id"], status: row["status"], total: Number(row["total"]), items };
}

/** No logs, redirects, cookies or token in URL. Origin validates browser context, never identity. */
export async function handlePrivateTrackingRequest(
  request: Request,
  deps: TrackingDependencies,
): Promise<Response> {
  const started = performance.now();
  const reply = async (status: number, body: unknown): Promise<Response> => {
    // Common lower bound reduces obvious denial timing differences, not a constant-time guarantee.
    const delay = 80 - (performance.now() - started);
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    return Response.json(body, { status, headers });
  };
  const denied = () => reply(403, { error: "Acompanhamento indisponível." });
  if (!deps.enabled) return reply(503, { error: "Acompanhamento indisponível." });
  try {
    if (request.method !== "POST") return reply(405, { error: "Acompanhamento indisponível." });
    const url = new URL(request.url);
    // Deployment MUST construct Request.url from the trusted Host, not X-Forwarded-Host.
    if (
      url.protocol !== "https:" ||
      url.search ||
      url.hash ||
      url.port ||
      !deps.canonicalDomains.includes(url.hostname) ||
      request.headers.get("origin") !== url.origin ||
      (request.headers.has("host") && request.headers.get("host") !== url.host) ||
      request.headers.has("forwarded") ||
      request.headers.has("x-forwarded-host") ||
      request.headers.has("x-forwarded-proto")
    )
      return denied();
    // Quota precedes context lookup and all database access. Unknown quota state denies.
    if (!(await deps.reserveIngress(request)))
      return reply(429, { error: "Acompanhamento indisponível." });
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? ""))
      return denied();
    const body = (await readBoundedJson(request, 2048)) as Record<string, unknown>;
    const bearer = request.headers.get("authorization") ?? "";
    const token = bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
    if (
      !body ||
      typeof body !== "object" ||
      Object.keys(body).some((key) => key !== "order_id") ||
      !UUID.test(String(body["order_id"])) ||
      !TOKEN.test(token)
    )
      return denied();
    const context = await deps.resolveContext(url.hostname);
    if (!context || context.domain !== url.hostname) return denied();
    const projected = trackingProjection(
      await deps.track(context, String(body["order_id"]), token),
    );
    if (!projected || projected["order_id"] !== body["order_id"]) return denied();
    return reply(200, projected);
  } catch {
    return denied();
  }
}
