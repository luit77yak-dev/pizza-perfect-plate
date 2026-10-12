import { createHmac } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  handleCheckoutRequest,
  CheckoutRateLimitError,
  type OrderResult,
  type StoreContext,
} from "./checkout-gateway";

/**
 * Server-only adapter. Never import this file from React components.
 * SUPABASE_SERVICE_ROLE_KEY is read exclusively by client.server.ts.
 */
export function checkoutGatewayEnabled(): boolean {
  return process.env["NEROXA_CHECKOUT_GATEWAY_ENABLED"] === "true";
}

// Generated database types describe the pre-migration production contract. The
// two RPCs below belong to the candidate schema and are verified in isolated CI.
// Keep the untyped boundary *inside the server-only module*, never in the browser.
type CandidateRpcClient = {
  rpc: (
    name: string,
    arguments_: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { code?: string } | null }>;
};

export async function handlePrivateCheckout(request: Request): Promise<Response> {
  // Supabase admin proxy is created only after the feature flag is checked.
  if (!checkoutGatewayEnabled()) {
    return handleCheckoutRequest(request, {
      enabled: false,
      resolveContext: async () => null,
      reserveQuota: async () => { throw new Error("Gateway disabled"); },
      createOrder: async () => { throw new Error("Gateway disabled"); },
    });
  }
  // No HMAC key, no privileged checkout. Never substitute a fixed/shared key.
  const secret = process.env["NEROXA_CHECKOUT_RATE_LIMIT_SECRET"];
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    return handleCheckoutRequest(request, {
      enabled: false,
      resolveContext: async () => null,
      reserveQuota: async () => { throw new Error("Quota secret unavailable"); },
      createOrder: async () => { throw new Error("Quota secret unavailable"); },
    });
  }
  const candidate = supabaseAdmin as unknown as CandidateRpcClient;
  return handleCheckoutRequest(request, {
    enabled: checkoutGatewayEnabled(),
    resolveContext: async (domain): Promise<StoreContext | null> => {
      const { data, error } = await candidate.rpc("get_public_storefront_context", {
        p_domain: domain,
      });
      if (error) throw new Error("Store resolution unavailable");
      const record = Array.isArray(data) ? data[0] : data;
      if (!record || typeof record !== "object") return null;
      const resolved = record as Record<string, unknown>;
      if (typeof resolved["domain"] !== "string" ||
        typeof resolved["instance_id"] !== "string" ||
        typeof resolved["organization_id"] !== "string") return null;
      return {
        domain: resolved["domain"],
        instance_id: resolved["instance_id"],
        organization_id: resolved["organization_id"],
      };
    },
    reserveQuota: async (context, customerPhone): Promise<void> => {
      const normalized = customerPhone.replace(/[^0-9]/g, "");
      // No raw telephone number, cookie or IP is persisted in quota tables.
      const digest = createHmac("sha256", secret)
        .update(context.instance_id + ":" + normalized)
        .digest("hex");
      const { data, error } = await candidate.rpc("neroxa_checkout_reserve_quota", {
        p_instance_id: context.instance_id,
        p_contact_fingerprint: digest,
      });
      if (error?.code === "PT429") throw new CheckoutRateLimitError("Quota exceeded");
      if (error || data !== true) throw new Error("Quota service unavailable");
    },
    createOrder: async (payload): Promise<OrderResult> => {
      const { data, error } = await candidate.rpc("create_public_order", {
        p_order: payload,
      });
      if (error) throw new Error("Order RPC rejected");
      const record = Array.isArray(data) ? data[0] : data;
      if (!record || typeof record !== "object") throw new Error("Order RPC returned no order");
      const row = record as Record<string, unknown>;
      if (typeof row["order_id"] !== "string") throw new Error("Invalid order ID");
      return {
        order_id: row["order_id"],
        order_number: Number(row["order_number"]),
        total: Number(row["total"]),
      };
    },
  });
}
