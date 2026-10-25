import { checkRuntimeBackend } from "../integrations/test-backend";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { handleCheckoutWithBackend, checkoutGatewayEnabled as enabled } from "./checkout-backend";

export function checkoutGatewayEnabled(): boolean {
  checkRuntimeBackend(true);
  return enabled(process.env);
}

/** Same RPC-backed handler exercised by the disposable integration suite. */
export async function handlePrivateCheckout(request: Request, recoverOnly = false): Promise<Response> {
  checkRuntimeBackend(true);
  // The proxy remains lazy; no service client is accessed while disabled.
  return handleCheckoutWithBackend(
    request,
    process.env,
    supabaseAdmin as unknown as Parameters<typeof handleCheckoutWithBackend>[2],
    recoverOnly,
  );
}
