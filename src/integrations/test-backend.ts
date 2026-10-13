import { assertServerBackend, testBackend } from "../core/delivery/backend-configuration";

export const testBackendConfiguration = testBackend({
  VITE_NEROXA_BACKEND_MODE: import.meta.env["VITE_NEROXA_BACKEND_MODE"],
  VITE_NEROXA_TEST_BACKEND_URL: import.meta.env["VITE_NEROXA_TEST_BACKEND_URL"],
  VITE_NEROXA_TEST_PROJECT_REF: import.meta.env["VITE_NEROXA_TEST_PROJECT_REF"],
  VITE_NEROXA_TEST_PUBLISHABLE_KEY: import.meta.env["VITE_NEROXA_TEST_PUBLISHABLE_KEY"],
  VITE_SUPABASE_URL: import.meta.env["VITE_SUPABASE_URL"],
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
});

/** SSR reads the exact same compiled public configuration, then checks runtime server configuration. */
export function checkRuntimeBackend(privileged = false): void {
  if (typeof window === "undefined")
    assertServerBackend(testBackendConfiguration, process.env, privileged);
}
