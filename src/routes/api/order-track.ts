import { createFileRoute } from "@tanstack/react-router";
import { handleClosedPrivateTracking } from "@/server/private-tracking-closed";

/** F01/F02 commercial admission is CLOSED; no privileged handler is connected here. */
export const Route = createFileRoute("/api/order-track")({
  server: {
    handlers: {
      POST: async ({ request }) => handleClosedPrivateTracking(request),
    },
  },
});
