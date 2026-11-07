import { handleCheckoutRequest } from "./checkout-gateway.ts";

/**
 * Shared ingress is exercised by the server route, but the live adapter is absent.
 * Remains unconditionally disabled even when env or browser flags are set.
 */
export function rejectPilotCheckout(request: Request): Promise<Response> {
  return handleCheckoutRequest(request, {
    enabled: false,
    resolveContext: async () => { throw new Error("Disabled"); },
    reserveQuota: async () => { throw new Error("Disabled"); },
    createOrder: async () => { throw new Error("Disabled"); },
  });
}
