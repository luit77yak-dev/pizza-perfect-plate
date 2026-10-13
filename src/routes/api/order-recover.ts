import { createFileRoute } from "@tanstack/react-router";

/**
 * Candidate privileged checkout endpoint. Disabled unless server operators
 * explicitly set NEROXA_CHECKOUT_GATEWAY_ENABLED=true.
 * The handler imports privileged code at request time, server-side only.
 */
export const Route = createFileRoute("/api/order-recover")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handlePrivateCheckout } = await import("@/server/checkout-gateway.server");
        return handlePrivateCheckout(request, true);
      },
    },
  },
});
