import { privateTrackingConfiguration } from "./private-tracking-backend.ts";
import { groupedContract } from "./group-contract.ts";
import { sameDeliveryBackend } from "../core/delivery/backend-binding.ts";
import { createHmac } from "node:crypto";
import {
  CheckoutPriceChangedError,
  CheckoutStoreClosedError,
  CheckoutRateLimitError,
  type StoreContext,
} from "./checkout-gateway.ts";
import {
  AmendmentAuthorizationError,
  AmendmentConflictError,
  type AmendmentDependencies,
  type AmendmentResult,
} from "./order-amendment.ts";

type CandidateRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { code?: string } | null }>;
};

export function orderAmendmentEnabled(env: Record<string, string | undefined>): boolean {
  return (
    privateTrackingConfiguration(env) !== null &&
    Buffer.byteLength(env["NEROXA_CHECKOUT_RATE_LIMIT_SECRET"] ?? "", "utf8") >= 32 &&
    sameDeliveryBackend(env["SUPABASE_URL"], env["NEROXA_DELIVERY_BACKEND_URL"]) &&
    env["NEROXA_CHECKOUT_GATEWAY_ENABLED"] === "true" &&
    env["NEROXA_CHECKOUT_AMENDMENTS_ENABLED"] === "true"
  );
}

/** Service credentials and the quota-HMAC secret never leave this server file. */
export function orderAmendmentDependencies(
  env: Record<string, string | undefined>,
  candidate: CandidateRpcClient,
): AmendmentDependencies {
  const secret = env["NEROXA_CHECKOUT_RATE_LIMIT_SECRET"];
  if (!orderAmendmentEnabled(env) || !secret || Buffer.byteLength(secret, "utf8") < 32) {
    return {
      enabled: false,
      resolveContext: async () => null,
      reserveQuota: async () => {
        throw new Error("Disabled");
      },
      appendItems: async () => {
        throw new Error("Disabled");
      },
    };
  }

  return {
    enabled: true,
    resolveContext: async (domain): Promise<StoreContext | null> => {
      if (!privateTrackingConfiguration(env)?.domains.includes(domain)) return null;
      const { data, error } = await candidate.rpc("get_public_storefront_context", {
        p_domain: domain,
      });
      if (error) throw new Error("Store context unavailable");
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || typeof row !== "object") return null;
      const record = row as Record<string, unknown>;
      if (
        typeof record["domain"] !== "string" ||
        typeof record["instance_id"] !== "string" ||
        typeof record["organization_id"] !== "string"
      )
        return null;
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
      if (groupedContract(details.items, env["NEROXA_GROUP_ADDONS_V1_ENABLED"] === "true")) {
        const advertised = await candidate.rpc("get_public_storefront_catalog", {
          p_domain: context.domain,
        });
        if (
          advertised.error ||
          !advertised.data ||
          typeof advertised.data !== "object" ||
          (advertised.data as Record<string, unknown>)["selection_contract"] !== "GROUP_ADDONS_V1"
        )
          throw new Error("Grouped backend unavailable");
      }
      const { data, error } = await candidate.rpc("neroxa_append_order_items_with_capability", {
        p_instance_id: context.instance_id,
        p_order_id: details.orderId,
        p_token: details.token,
        p_request_key: details.requestKey,
        p_items: details.items,
      });
      if (error?.code === "PT423") throw new CheckoutStoreClosedError();
      if (error?.code === "PT409") throw new CheckoutPriceChangedError("Price changed");
      if (error?.code === "42501") throw new AmendmentAuthorizationError("Forbidden");
      if (error?.code === "22023") throw new AmendmentConflictError("Order rejected");
      if (error) throw new Error("Secure amendment RPC unavailable");
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || typeof row !== "object") throw new Error("No amended order");
      const typed = row as Record<string, unknown>;
      if (typeof typed["order_id"] !== "string" || typed["payment_state"] !== "NOT_SETTLED")
        throw new Error("Invalid order/payment state");
      return {
        order_id: typed["order_id"],
        order_number: Number(typed["order_number"]),
        subtotal: Number(typed["subtotal"]),
        total: Number(typed["total"]),
        added_amount: Number(typed["added_amount"]),
        payment_state: "NOT_SETTLED",
      };
    },
  };
}
