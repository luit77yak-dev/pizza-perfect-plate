import { handlePrivateTrackingRequest } from "./private-tracking";
import { checkRuntimeBackend } from "../integrations/test-backend";

/** Fail closed until durable ingress quota and trusted proxy integration are validated. */
export function handlePrivateTracking(request: Request): Promise<Response> {
  checkRuntimeBackend(true);
  return handlePrivateTrackingRequest(request, {
    enabled: false, // NEROXA_PRIVATE_TRACKING_ENABLED cannot bypass missing infrastructure.
    canonicalDomains: [],
    reserveIngress: async () => false,
    resolveContext: async () => null,
    track: async () => null,
  });
}
