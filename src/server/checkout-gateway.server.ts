import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  handleCheckoutRequest,
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

export async function handlePrivateCheckout(request: Request): Promise<Response> {
  return handleCheckoutRequest(request, {
    enabled: checkoutGatewayEnabled(),
    resolveContext: async (domain): Promise<StoreContext | null> => {
      const { data, error } = await supabaseAdmin.rpc("get_public_storefront_context", {
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
    createOrder: async (payload): Promise<OrderResult> => {
      const { data, error } = await supabaseAdmin.rpc("create_public_order", {
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
