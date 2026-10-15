import { handlePrivateTrackingRequest } from "./private-tracking";
import {
  privateTrackingConfiguration,
  privateTrackingDependencies,
  type TrackingRpc,
} from "./private-tracking-backend";
import { checkRuntimeBackend } from "../integrations/test-backend";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Production remains off even if the tracking flag is accidentally true. */
export function handlePrivateTracking(request: Request): Promise<Response> {
  checkRuntimeBackend(true);
  const enabled = privateTrackingConfiguration(process.env) !== null;
  return handlePrivateTrackingRequest(
    request,
    privateTrackingDependencies(
      enabled ? process.env : {},
      supabaseAdmin as unknown as TrackingRpc,
    ),
  );
}
