/** Configuration boundaries, never tenant/user authorization. Keys are validated by Supabase too. */
export type BackendEnvironment = Record<string, string | undefined>;
export type TestBackend = Readonly<{ url: string; key: string; project: string }>;
const forbiddenProjects = new Set(["iefaoaqzltvpfabyeelj", "uvyinrojuhizjqbuzdcy"]);

function fail(): never {
  throw new Error("Invalid or incomplete homologation backend configuration");
}

export function canonicalBackendUrl(value: string | undefined): string {
  if (!value) return fail();
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return fail();
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return fail();
  return url.origin;
}

function jwtClaims(key: string): Record<string, unknown> {
  try {
    const parts = key.split(".");
    if (parts.length !== 3 || !parts.every(Boolean)) return fail();
    return JSON.parse(atob(parts[1]!.replaceAll("-", "+").replaceAll("_", "/"))) as Record<
      string,
      unknown
    >;
  } catch {
    return fail();
  }
}

function validateKey(key: string, project: string, privileged = false): void {
  if (privileged && /^sb_secret_[A-Za-z0-9_-]{20,}$/.test(key)) return;
  if (!privileged && /^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(key)) return;
  const claims = jwtClaims(key);
  if (typeof claims["ref"] === "string" && forbiddenProjects.has(claims["ref"])) return fail();
  if (claims["role"] !== (privileged ? "service_role" : "anon")) return fail();
  if (project !== "local-disposable" && claims["ref"] !== project) return fail();
  // This parsing is an accidental-misconfiguration guard, NOT signature verification.
}

export function testBackend(env: BackendEnvironment): TestBackend | null {
  const mode = env["VITE_NEROXA_BACKEND_MODE"];
  if (mode === undefined || mode === "production") {
    if (Object.keys(env).some((k) => k.startsWith("VITE_NEROXA_TEST_") && env[k])) return fail();
    return null;
  }
  if (mode !== "homologation") return fail();
  const url = canonicalBackendUrl(env["VITE_NEROXA_TEST_BACKEND_URL"]);
  const project = env["VITE_NEROXA_TEST_PROJECT_REF"];
  const key = env["VITE_NEROXA_TEST_PUBLISHABLE_KEY"];
  if (!project || !key || forbiddenProjects.has(project)) return fail();
  const parsed = new URL(url);
  if (project === "local-disposable") {
    if (!["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname) || !parsed.port)
      return fail();
  } else if (
    !/^[a-z]{20}$/.test(project) ||
    parsed.hostname !== `${project}.supabase.co` ||
    parsed.port
  )
    return fail();
  validateKey(key, project);
  if (env["VITE_SUPABASE_URL"] && canonicalBackendUrl(env["VITE_SUPABASE_URL"]) !== url)
    return fail();
  if (env["VITE_SUPABASE_PUBLISHABLE_KEY"] && env["VITE_SUPABASE_PUBLISHABLE_KEY"] !== key)
    return fail();
  return Object.freeze({ url, key, project });
}

export function assertServerBackend(
  config: TestBackend | null,
  env: BackendEnvironment,
  privileged = false,
): void {
  if (!config) {
    if (env["NEROXA_BACKEND_MODE"] && env["NEROXA_BACKEND_MODE"] !== "production") return fail();
    return;
  }
  if (
    env["NEROXA_BACKEND_MODE"] !== "homologation" ||
    env["NEROXA_TEST_PROJECT_REF"] !== config.project
  )
    return fail();
  if (
    canonicalBackendUrl(env["SUPABASE_URL"]) !== config.url ||
    canonicalBackendUrl(env["NEROXA_DELIVERY_BACKEND_URL"]) !== config.url
  )
    return fail();
  if (env["SUPABASE_PUBLISHABLE_KEY"] !== config.key) return fail();
  if (privileged) validateKey(env["SUPABASE_SERVICE_ROLE_KEY"] ?? "", config.project, true);
}

export function assertBackendRequest(config: TestBackend | null, input: RequestInfo | URL): void {
  if (!config) return;
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin !== config.url || url.username || url.password) return fail();
}

export function configuredStoreDomain(config: TestBackend | null, hostname: string): string {
  const host = hostname.replace(/\.$/, "").toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(host)) return fail();
  if (
    !config &&
    (host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".lovable.app") ||
      host.endsWith(".lovableproject.com"))
  )
    return "food.neroxa.ia.br";
  return host; // Unknown test domains must be resolved/denied by the configured backend.
}

const keyChecks = new WeakMap<TestBackend, Promise<void>>();
/** Validate opaque public keys at the allowed destination; never probe another backend. */
export async function ensureTestBackendKey(
  config: TestBackend | null,
  transport: typeof fetch = fetch,
): Promise<void> {
  if (!config) return;
  let pending = keyChecks.get(config);
  if (!pending) {
    pending = (async () => {
      const response = await transport(`${config.url}/auth/v1/settings`, {
        headers: { apikey: config.key },
        redirect: "error",
      });
      if (!response.ok || (response.url && new URL(response.url).origin !== config.url))
        return fail();
      const settings: unknown = await response.json();
      if (!settings || typeof settings !== "object" || !("external" in settings)) return fail();
    })();
    keyChecks.set(config, pending);
  }
  await pending;
}
