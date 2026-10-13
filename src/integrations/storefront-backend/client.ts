import {
  assertBackendRequest,
  ensureTestBackendKey,
  configuredStoreDomain,
} from "../../core/delivery/backend-configuration";
import { checkRuntimeBackend, testBackendConfiguration } from "../test-backend";
import { createClient } from "@supabase/supabase-js";

// Public storefront backend (same one used by food.neroxa.ia.br).
// The publishable key is safe to ship in browser code; access is enforced by RLS.
checkRuntimeBackend();
export const STOREFRONT_URL =
  testBackendConfiguration?.url ?? "https://iefaoaqzltvpfabyeelj.supabase.co";
const STOREFRONT_PUBLISHABLE_KEY =
  testBackendConfiguration?.key ?? "sb_publishable_-7jcJhtrCicArfXEq6Z69A_M9qdQQqe";

// Hosts that are not registered store domains (local dev, Lovable preview)
// load this store so the preview mirrors production.
export const PREVIEW_FALLBACK_DOMAIN = "food.neroxa.ia.br";

export function resolveStorefrontDomain(hostname: string) {
  return configuredStoreDomain(testBackendConfiguration, hostname);
}

export const supabase = createClient(STOREFRONT_URL, STOREFRONT_PUBLISHABLE_KEY, {
  global: {
    fetch: async (input, init) => {
      checkRuntimeBackend();
      assertBackendRequest(testBackendConfiguration, input);
      await ensureTestBackendKey(testBackendConfiguration);
      const headers = new Headers(init?.headers);
      if (headers.get("Authorization") === `Bearer ${STOREFRONT_PUBLISHABLE_KEY}`)
        headers.delete("Authorization");
      headers.set("apikey", STOREFRONT_PUBLISHABLE_KEY);
      return fetch(input, {
        ...init,
        headers,
        ...(testBackendConfiguration ? { redirect: "error" as const } : {}),
      });
    },
  },
  auth: { persistSession: false, autoRefreshToken: false, storageKey: "ppp-storefront-backend" },
});
