import { createHash, createHmac, randomBytes } from "node:crypto";
import {
  CheckoutPriceChangedError,
  CheckoutRateLimitError,
  CheckoutStoreClosedError,
} from "./checkout-gateway.ts";
import {
  disposableCheckoutAllowed,
  type DisposableCheckoutBackend,
  type DisposableCheckoutEnvironment,
} from "./pilot-disposable-checkout-adapter.ts";

/**
 * Contract-level RPC adapter for an injected disposable test driver.
 * No Supabase client, fetch, secrets or connection is created here.
 * NEVER import this module from the public /api/checkout route.
 *
 * RPC names mirror the legacy order and candidate atomic buyer-registration
 * contracts. Whether the native SQL enforces tenant/pricing ACLs is NOT proved.
 */
export type DisposableRpcTransport = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { code?: string } | null }>;
};

function oneRecord(data: unknown): Record<string, unknown> | null {
  const value = Array.isArray(data) ? data[0] : data;
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function rpcAdmission(env: DisposableCheckoutEnvironment): string | null {
  if (
    !disposableCheckoutAllowed(env) ||
    env["NEROXA_PILOT_RPC_CONTRACT"] !== "emulated-atomic-v1"
  ) return null;
  const secret = env["NEROXA_CHECKOUT_RATE_LIMIT_SECRET"];
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) return null;
  return secret;
}

/**
 * Positive calls are possible only against a test-injected RPC transport.
 * The live endpoint has no import path to this factory and remains 503.
 */
export function createDisposableRpcBackend(
  env: DisposableCheckoutEnvironment,
  transport: DisposableRpcTransport,
): DisposableCheckoutBackend {
  const secret = rpcAdmission(env);
  const admitted = secret !== null;

  return {
    async resolveContext(domain) {
      if (!admitted) throw new Error("RPC test contract disabled");
      const response = await transport.rpc("get_public_storefront_context", {
        p_domain: domain,
      });
      if (response.error) throw new Error("Store context unavailable");
      const row = oneRecord(response.data);
      if (
        !row ||
        typeof row["domain"] !== "string" ||
        typeof row["instance_id"] !== "string" ||
        typeof row["organization_id"] !== "string"
      ) return null;
      return {
        domain: row["domain"],
        instance_id: row["instance_id"],
        organization_id: row["organization_id"],
      };
    },

    async reserveQuota(context, customerPhone) {
      if (!admitted || !secret) throw new Error("RPC test contract disabled");
      const normalized = customerPhone.replace(/[^0-9]/g, "");
      const fingerprint = createHmac("sha256", secret)
        .update(context.instance_id + ":" + normalized)
        .digest("hex");
      const response = await transport.rpc("neroxa_checkout_reserve_quota", {
        p_instance_id: context.instance_id,
        p_contact_fingerprint: fingerprint,
      });
      if (response.error?.code === "PT429") throw new CheckoutRateLimitError();
      if (response.error || response.data !== true) throw new Error("Quota unavailable");
    },

    async createOrder(payload) {
      if (!admitted) throw new Error("RPC test contract disabled");
      const order = await transport.rpc("create_public_order", {
        p_order: payload,
      });
      if (order.error?.code === "PT409") throw new CheckoutPriceChangedError();
      if (order.error?.code === "PT423") throw new CheckoutStoreClosedError();
      if (order.error) throw new Error("Order RPC unavailable");
      const row = oneRecord(order.data);
      if (
        !row ||
        typeof row["order_id"] !== "string" ||
        typeof row["order_number"] !== "number" ||
        typeof row["total"] !== "number"
      ) throw new Error("Invalid order RPC response");

      // Mirrors the Master SQL candidate, which registers both capabilities
      // in one transaction. Order creation and registration are NOT atomic
      // with each other; a registration failure must never signal success.
      const trackingToken = randomBytes(32).toString("base64url");
      const amendmentToken = randomBytes(32).toString("base64url");
      const registered = await transport.rpc("neroxa_register_buyer_capabilities", {
        p_instance_id: payload["instance_id"],
        p_order_id: row["order_id"],
        p_checkout_key: payload["idempotency_key"],
        p_tracking_sha256: createHash("sha256").update(trackingToken).digest("hex"),
        p_amendment_sha256: createHash("sha256").update(amendmentToken).digest("hex"),
      });
      if (registered.error || typeof registered.data !== "boolean") {
        throw new Error("Buyer capability registration unavailable");
      }
      return {
        order_id: row["order_id"],
        order_number: row["order_number"],
        total: row["total"],
        ...(registered.data ? { tracking_token: trackingToken, amendment_token: amendmentToken } : {}),
      };
    },
  };
}
