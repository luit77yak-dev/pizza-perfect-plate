import { checkRuntimeBackend, testBackendConfiguration } from "../integrations/test-backend";
import { serverConfiguration, PROJECT } from "./hosted-release-core.mjs";

/** Server-only alternative to the local laboratory boundary; no lab flag admits hosting. */
export function assertServerAdmission(): void {
  if (process.env["NEROXA_BACKEND_MODE"] !== "hosted-release") {
    checkRuntimeBackend(true);
    return;
  }
  if (testBackendConfiguration !== null ||
      import.meta.env["VITE_SUPABASE_URL"] !== `https://${PROJECT}.supabase.co`)
    throw new Error("Hosted build/backend not admitted");
  serverConfiguration(process.env); // pinned trust remains closed in this candidate
}
