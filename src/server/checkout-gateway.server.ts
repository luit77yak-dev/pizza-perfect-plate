import { assertServerAdmission } from "./hosted-admission.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { handleCheckoutWithBackend, checkoutGatewayEnabled as enabled } from "./checkout-backend";

export function checkoutGatewayEnabled(): boolean {
  assertServerAdmission();
  return enabled(process.env);
}

/** Same RPC-backed handler exercised by the disposable integration suite. */
export async function handlePrivateCheckout(request: Request, recoverOnly = false): Promise<Response> {
  assertServerAdmission();
  // The proxy remains lazy; no service client is accessed while disabled.
  return handleCheckoutWithBackend(
    request,
    process.env,
    supabaseAdmin as unknown as Parameters<typeof handleCheckoutWithBackend>[2],
    recoverOnly,
  );
}
