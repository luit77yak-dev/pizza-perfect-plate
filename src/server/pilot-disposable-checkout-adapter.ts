import { sameDeliveryBackend } from "../core/delivery/backend-binding.ts";
import {
  handleCheckoutRequest,
  type CheckoutDependencies,
  type OrderResult,
  type StoreContext,
} from "./checkout-gateway.ts";

/**
 * Disposable-only adapter: never import from a public route or browser bundle.
 * This takes injected back-end operations; it does not construct a DB client.
 * The real /api/checkout route must remain unconditionally closed (HTTP 503).
 */
export type DisposableCheckoutBackend = {
  resolveContext: (domain: string) => Promise<StoreContext | null>;
  reserveQuota: (context: StoreContext, customerPhone: string) => Promise<void>;
  createOrder: (payload: Record<string, unknown>) => Promise<OrderResult>;
};

export type DisposableCheckoutEnvironment = Record<string, string | undefined>;

function permittedDomains(env: DisposableCheckoutEnvironment): string[] | null {
  const input = env["NEROXA_PILOT_TEST_DOMAINS"] ?? "";
  const domains = input.split(",");
  if (
    domains.length < 1 ||
    domains.length > 3 ||
    domains.some((domain) => !/^[a-z0-9-]+\.synthetic\.invalid$/.test(domain)) ||
    new Set(domains).size !== domains.length
  ) {
    return null;
  }
  return domains;
}

/**
 * Flag alone cannot enable this adapter. Synthetic, loopback-only conditions
 * are mandatory, so hosted Supabase, production or a Vercel deploy fail closed.
 */
export function disposableCheckoutAllowed(env: DisposableCheckoutEnvironment): boolean {
  if (
    env["NEROXA_PILOT_PRIVATE_ADAPTER"] !== "synthetic-test-only" ||
    env["NEROXA_BACKEND_MODE"] !== "homologation" ||
    env["NEROXA_TEST_PROJECT_REF"] !== "local-disposable" ||
    !permittedDomains(env) ||
    !sameDeliveryBackend(env["SUPABASE_URL"], env["NEROXA_DELIVERY_BACKEND_URL"])
  ) return false;

  try {
    const url = new URL(env["SUPABASE_URL"] ?? "");
    return url.protocol === "http:" && url.hostname === "127.0.0.1" &&
      url.port !== "" && url.pathname === "/";
  } catch {
    return false;
  }
}

/**
 * Shared ingress validates Host/Origin, body, tenant identity and errors.
 * Positive calls are possible only with an explicit injected fake backend
 * and a synthetic-only environment, never from the production HTTP route.
 */
export function handleDisposableCheckout(
  request: Request,
  env: DisposableCheckoutEnvironment,
  backend: DisposableCheckoutBackend,
): Promise<Response> {
  const domains = permittedDomains(env);
  const enabled = disposableCheckoutAllowed(env) && domains !== null;

  const operations: CheckoutDependencies = {
    enabled,
    resolveContext: async (domain) => {
      if (!enabled || !domains?.includes(domain)) return null;
      return backend.resolveContext(domain);
    },
    reserveQuota: async (context, phone) => {
      if (!enabled) throw new Error("Disabled");
      return backend.reserveQuota(context, phone);
    },
    createOrder: async (payload) => {
      if (!enabled) throw new Error("Disabled");
      return backend.createOrder(payload);
    },
  };
  return handleCheckoutRequest(request, operations);
}
