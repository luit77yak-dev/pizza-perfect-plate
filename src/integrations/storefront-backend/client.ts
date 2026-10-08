import { createClient } from "@supabase/supabase-js";

// Public storefront backend (same one used by food.neroxa.ia.br).
// The publishable key is safe to ship in browser code; access is enforced by RLS.
const STOREFRONT_URL = "https://iefaoaqzltvpfabyeelj.supabase.co";
const STOREFRONT_PUBLISHABLE_KEY = "sb_publishable_-7jcJhtrCicArfXEq6Z69A_M9qdQQqe";

// Hosts that are not registered store domains (local dev, Lovable preview)
// load this store so the preview mirrors production.
export const PREVIEW_FALLBACK_DOMAIN = "food.neroxa.ia.br";

export function resolveStorefrontDomain(hostname: string) {
  const host = hostname.replace(/\.$/, "").toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".lovable.app") || host.endsWith(".lovableproject.com")) {
    return PREVIEW_FALLBACK_DOMAIN;
  }
  return host;
}

export const supabase = createClient(STOREFRONT_URL, STOREFRONT_PUBLISHABLE_KEY, {
  global: {
    fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (headers.get("Authorization") === `Bearer ${STOREFRONT_PUBLISHABLE_KEY}`) headers.delete("Authorization");
      headers.set("apikey", STOREFRONT_PUBLISHABLE_KEY);
      return fetch(input, { ...init, headers });
    },
  },
  auth: { persistSession: false, autoRefreshToken: false, storageKey: "ppp-storefront-backend" },
});
