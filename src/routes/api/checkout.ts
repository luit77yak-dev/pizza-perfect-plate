import { createFileRoute } from "@tanstack/react-router";
import { rejectPilotCheckout } from "@/server/pilot-checkout-closed";

/** No database call or privileged client is reachable from this endpoint. */
export const Route = createFileRoute("/api/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => rejectPilotCheckout(request),
    },
  },
});
