import { createFileRoute } from "@tanstack/react-router";

/**
 * Candidate server-only buyer amendment ingress.
 * Remains disabled unless BOTH server checkout and amendment flags are true.
 */
export const Route = createFileRoute("/api/order-amend")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handlePrivateOrderAmendment } = await import(
          "@/server/order-amendment.server"
        );
        return handlePrivateOrderAmendment(request);
      },
    },
  },
});
