import { checkRuntimeBackend } from "../integrations/test-backend";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { handleOrderAmendmentRequest } from "./order-amendment";
import { orderAmendmentDependencies, orderAmendmentEnabled } from "./order-amendment-backend";

export async function handlePrivateOrderAmendment(request: Request): Promise<Response> {
  checkRuntimeBackend(true);
  const enabled = orderAmendmentEnabled(process.env);
  // Do not touch the lazy service client unless the local-only candidate is enabled.
  const backend = enabled
    ? (supabaseAdmin as unknown as Parameters<typeof orderAmendmentDependencies>[1])
    : {
        rpc: async () => {
          throw new Error("Disabled");
        },
      };
  return handleOrderAmendmentRequest(request, orderAmendmentDependencies(process.env, backend));
}
