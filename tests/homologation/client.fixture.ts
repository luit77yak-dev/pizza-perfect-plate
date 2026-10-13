// Test-only dependency injection. Never included by the production Vite config.
import { createClient } from "@supabase/supabase-js";
export const STOREFRONT_URL = "http://127.0.0.1:54321";
export const PREVIEW_FALLBACK_DOMAIN = "a.ab.invalid";
export function resolveStorefrontDomain(hostname: string) {
  return ["localhost", "127.0.0.1"].includes(hostname) ? PREVIEW_FALLBACK_DOMAIN : hostname;
}
export const supabase = createClient(STOREFRONT_URL, "synthetic-intercepted-only", {
  auth: { persistSession: false, autoRefreshToken: false },
});
