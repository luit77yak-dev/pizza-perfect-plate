import { createHmac } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CheckoutRateLimitError, type StoreContext } from "./checkout-gateway";
import {
  AmendmentAuthorizationError,
  AmendmentConflictError,
  handleOrderAmendmentRequest,
  type AmendmentResult,
} from "./order-amendment";

type CandidateRpcClient = {
  rpc: (name: string, args: Record<string, unknown>) =>
    Promise<{ data: unknown; error: { code?: string } | null }>;
};

function enabled(): boolean {
  return process.env["NEROXA_CHECKOUT_GATEWAY_ENABLED"] === "true" &&
    process.env["NEROXA_CHECKOUT_AMENDMENTS_ENABLED"] === "true";
}

/** Service credentials and the quota-HMAC secret never leave this server file. */
export async function handlePrivateOrderAmendment(request: Request): Promise<Response> {
  const secret = process.env["NEROXA_CHECKOUT_RATE_LIMIT_SECRET"];
  if (!enabled() || !secret || Buffer.byteLength(secret, "utf8") < 32) {
    return handleOrderAmendmentRequest(request, {
      enabled: false,
      resolveContext: async () => null,
      reserveQuota: async () => { throw new Error("Disabled"); },
      appendItems: async () => { throw new Error("Disabled"); },
    });
  }

  const candidate = supabaseAdmin as unknown as CandidateRpcClient;
  return handleOrderAmendmentRequest(request, {
    enabled: true,
    resolveContext: async (domain): Promise<StoreContext | null> => {
      const { data, error } = await candidate.rpc("get_public_storefront_context", {
        p_domain: domain,
      });
      if (error) throw new Error("Store context unavailable");
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || typeof row !== "object") return null;
      const record = row as Record<string, unknown>;
      if (typeof record["domain"] !== "string" ||
        typeof record["instance_id"] !== "string" ||
        typeof record["organization_id"] !== "string") return null;
      return {
        domain: record["domain"],
        instance_id: record["instance_id"],
        organization_id: record["organization_id"],
      };
    },
    reserveQuota: async (context, token): Promise<void> => {
      // Use the high-entropy token only as an input to a separate server HMAC.
      // Never persist the raw capability or use the customer phone as identity.
      const digest = createHmac("sha256", secret)
        .update(context.instance_id + ":amend:" + token)
        .digest("hex");
      const { data, error } = await candidate.rpc("neroxa_checkout_reserve_quota", {
        p_instance_id: context.instance_id,
        p_contact_fingerprint: digest,
      });
      if (error?.code === "PT429") throw new CheckoutRateLimitError("Quota exceeded");
      if (error || data !== true) throw new Error("Quota RPC unavailable");
    },
    appendItems: async (context, details): Promise<AmendmentResult> => {
      const { data, error } = await candidate.rpc("neroxa_append_order_items_with_capability", {
        p_instance_id: context.instance_id,
        p_order_id: details.orderId,
        p_token: details.token,
        p_request_key: details.requestKey,
        p_items: details.items,
      });
      if (error?.code === "42501") throw new AmendmentAuthorizationError("Forbidden");
      if (error?.code === "22023") throw new AmendmentConflictError("Order rejected");
      if (error) throw new Error("Secure amendment RPC unavailable");
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || typeof row !== "object") throw new Error("No amended order");
      const typed = row as Record<string, unknown>;
      if (typeof typed["order_id"] !== "string") throw new Error("Invalid order");
      return {
        order_id: typed["order_id"],
        order_number: Number(typed["order_number"]),
        subtotal: Number(typed["subtotal"]),
        total: Number(typed["total"]),
        added_amount: Number(typed["added_amount"]),
        payment_state: "NOT_SETTLED",
      };
    },
  });
}
