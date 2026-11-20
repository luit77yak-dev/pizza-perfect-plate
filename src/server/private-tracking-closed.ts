import { handlePrivateTrackingRequest, type TrackingDependencies } from "./private-tracking.ts";

/** This adapter is intentionally NOT configurable via environment flags. */
const CLOSED_DEPENDENCIES: TrackingDependencies = {
  enabled: false,
  canonicalDomains: [],
  reserveIngress: async () => false,
  resolveContext: async () => null,
  track: async () => null,
};

/** No Supabase client, database binding or hosted admission is reachable here. */
export function handleClosedPrivateTracking(request: Request): Promise<Response> {
  return handlePrivateTrackingRequest(request, CLOSED_DEPENDENCIES);
}
