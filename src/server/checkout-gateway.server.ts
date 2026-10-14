import { issueTrackingOnce } from "./tracking-issuance";
import { checkRuntimeBackend } from "../integrations/test-backend";
import { groupedContract } from "./group-contract";
import { sameDeliveryBackend } from "../core/delivery/backend-binding";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  handleCheckoutRequest,
  CheckoutRateLimitError,
  CheckoutPriceChangedError,
  CheckoutStoreClosedError,
  CheckoutRecoveryDeniedError,
  CheckoutRecoveryExpiredError,
  type OrderResult,
  type StoreContext,
} from "./checkout-gateway";

/**
 * Server-only adapter. Never import this file from React components.
 * SUPABASE_SERVICE_ROLE_KEY is read exclusively by client.server.ts.
 */
export function checkoutGatewayEnabled(): boolean {
  checkRuntimeBackend(true);
  return (
    process.env["NEROXA_CHECKOUT_GATEWAY_ENABLED"] === "true" &&
    (process.env["NEROXA_REQUIRE_DURABLE_CHECKOUT_INTENTS"] !== "true" ||
      process.env["NEROXA_GROUP_ADDONS_V1_ENABLED"] === "true") &&
    sameDeliveryBackend(process.env["SUPABASE_URL"], process.env["NEROXA_DELIVERY_BACKEND_URL"])
  );
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

export async function handlePrivateCheckout(
  request: Request,
  recoverOnly = false,
): Promise<Response> {
  if (
    recoverOnly &&
    (process.env["NEROXA_CHECKOUT_RECOVERY_ENABLED"] !== "true" ||
      process.env["NEROXA_REQUIRE_DURABLE_CHECKOUT_INTENTS"] !== "true" ||
      process.env["NEROXA_GROUP_ADDONS_V1_ENABLED"] !== "true")
  )
    return Response.json(
      { error: "Recuperação segura indisponível." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  // The buyer gateway is not integrated yet. An operator flag cannot enable
  // half an integration or mint credentials for an unavailable tracking route.
  if (process.env["NEROXA_PRIVATE_TRACKING_ENABLED"] === "true")
    return Response.json(
      { error: "Integração privada pendente de validação." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  // Supabase admin proxy is created only after the feature flag is checked.
  if (!checkoutGatewayEnabled()) {
    return handleCheckoutRequest(request, {
      enabled: false,
      resolveContext: async () => null,
      reserveQuota: async () => {
        throw new Error("Gateway disabled");
      },
      createOrder: async () => {
        throw new Error("Gateway disabled");
      },
    });
  }
  // No HMAC key, no privileged checkout. Never substitute a fixed/shared key.
  const secret = process.env["NEROXA_CHECKOUT_RATE_LIMIT_SECRET"];
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    return handleCheckoutRequest(request, {
      enabled: false,
      resolveContext: async () => null,
      reserveQuota: async () => {
        throw new Error("Quota secret unavailable");
      },
      createOrder: async () => {
        throw new Error("Quota secret unavailable");
      },
    });
  }
  const candidate = supabaseAdmin as unknown as CandidateRpcClient;
  return handleCheckoutRequest(request, {
    enabled: checkoutGatewayEnabled(),
    requiresDurableIntent: process.env["NEROXA_REQUIRE_DURABLE_CHECKOUT_INTENTS"] === "true",
    resolveContext: async (domain): Promise<StoreContext | null> => {
      const { data, error } = await candidate.rpc("get_public_storefront_context", {
        p_domain: domain,
      });
      if (error) throw new Error("Store resolution unavailable");
      const record = Array.isArray(data) ? data[0] : data;
      if (!record || typeof record !== "object") return null;
      const resolved = record as Record<string, unknown>;
      if (
        typeof resolved["domain"] !== "string" ||
        typeof resolved["instance_id"] !== "string" ||
        typeof resolved["organization_id"] !== "string"
      )
        return null;
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
        .update((recoverOnly ? "recovery:" : "") + context.instance_id + ":" + normalized)
        .digest("hex");
      const { data, error } = await candidate.rpc(
        recoverOnly ? "neroxa_recovery_reserve_quota" : "neroxa_checkout_reserve_quota",
        {
          p_instance_id: context.instance_id,
          p_contact_fingerprint: digest,
        },
      );
      if (error?.code === "PT429") throw new CheckoutRateLimitError("Quota exceeded");
      if (error || data !== true) throw new Error("Quota service unavailable");
    },
    createOrder: async (payload): Promise<OrderResult> => {
      const recover = async (): Promise<Record<string, unknown>> => {
        const r = await candidate.rpc("neroxa_recover_group_order", {
          p_instance_id: payload["instance_id"],
          p_checkout_key: payload["idempotency_key"],
          p_order: payload,
        });
        if (r.error?.code === "PT410") throw new CheckoutRecoveryExpiredError();
        if (r.error?.code === "42501") throw new CheckoutRecoveryDeniedError();
        if (r.error || !r.data || typeof r.data !== "object")
          throw new Error("Recovery unavailable");
        return r.data as Record<string, unknown>;
      };
      if (recoverOnly) {
        const snapshot = await recover();
        return {
          order_id: String(snapshot["order_id"]),
          order_number: Number(snapshot["order_number"]),
          total: Number(snapshot["total"]),
          snapshot,
        };
      }

      if (
        groupedContract(payload["items"], process.env["NEROXA_GROUP_ADDONS_V1_ENABLED"] === "true")
      ) {
        const advertised = await candidate.rpc("get_public_storefront_catalog", {
          p_domain: payload["store_domain"],
        });
        if (
          advertised.error ||
          !advertised.data ||
          typeof advertised.data !== "object" ||
          (advertised.data as Record<string, unknown>)["selection_contract"] !== "GROUP_ADDONS_V1"
        )
          throw new Error("Grouped backend unavailable");
      }
      const { data, error } = await candidate.rpc("create_public_order", {
        p_order: payload,
      });
      if (error?.code === "PT410") throw new CheckoutRecoveryExpiredError();
      if (error?.code === "PT423") throw new CheckoutStoreClosedError("Store closed");
      if (error?.code === "PT409") throw new CheckoutPriceChangedError("Price changed");
      if (error) throw new Error("Order RPC rejected");
      const record = Array.isArray(data) ? data[0] : data;
      if (!record || typeof record !== "object") throw new Error("Order RPC returned no order");
      const row = record as Record<string, unknown>;
      if (typeof row["order_id"] !== "string") throw new Error("Invalid order ID");
      const snapshot =
        process.env["NEROXA_REQUIRE_DURABLE_CHECKOUT_INTENTS"] === "true"
          ? await recover()
          : undefined;
      // Separate tracking credential; never share the amendment capability.
      let trackingToken: string | undefined;
      if (process.env["NEROXA_PRIVATE_TRACKING_ENABLED"] === "true") {
        trackingToken = await issueTrackingOnce(async (digest) => {
          const registration = await candidate.rpc("neroxa_register_tracking_capability", {
            p_instance_id: payload["instance_id"],
            p_order_id: row["order_id"],
            p_checkout_key: payload["idempotency_key"],
            p_token_sha256: digest,
          });
          if (registration.error || typeof registration.data !== "boolean")
            throw new Error("Tracking capability unavailable");
          return registration.data;
        });
      }
      // Both checkout and amendments must be explicitly enabled at runtime.
      // This credential is minted by the server, never accepted from the
      // browser as a substitute for the order's authorization.
      if (process.env["NEROXA_CHECKOUT_AMENDMENTS_ENABLED"] === "true") {
        const token = randomBytes(32).toString("base64url");
        const digest = createHash("sha256").update(token).digest("hex");
        const { data: registered, error: registrationError } = await candidate.rpc(
          "neroxa_register_order_amendment_capability",
          {
            p_instance_id: payload["instance_id"],
            p_order_id: row["order_id"],
            p_checkout_key: payload["idempotency_key"],
            p_token_sha256: digest,
          },
        );
        if (registrationError || typeof registered !== "boolean") {
          // Fail closed. The order may already exist; client retry MUST reuse
          // its checkout idempotency key to complete registration safely.
          throw new Error("Amendment capability unavailable");
        }
        if (registered) {
          return {
            order_id: row["order_id"],
            order_number: Number(row["order_number"]),
            total: Number(row["total"]),
            amendment_token: token,
            ...(trackingToken ? { tracking_token: trackingToken } : {}),
            ...(snapshot ? { snapshot } : {}),
          };
        }
        // A replay cannot reissue or rotate the initial buyer capability.
      }
      return {
        order_id: row["order_id"],
        order_number: Number(row["order_number"]),
        total: Number(row["total"]),
        ...(trackingToken ? { tracking_token: trackingToken } : {}),
        ...(snapshot ? { snapshot } : {}),
      };
    },
  });
}
