import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/order-track")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handlePrivateTracking } = await import("@/server/private-tracking.server");
        return handlePrivateTracking(request);
      },
    },
  },
});
