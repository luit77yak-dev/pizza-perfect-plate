import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv, type ConfigEnv } from "vite";
import { assertServerBackend, testBackend } from "./src/core/delivery/backend-configuration";

export default async (environment: ConfigEnv) => {
  const config = testBackend({
    ...loadEnv(environment.mode, process.cwd(), "VITE_"),
    ...process.env,
  });
  if (environment.mode === "homologation" && !config) {
    throw new Error("Homologation build requires explicit backend configuration");
  }
  if (config) assertServerBackend(config, process.env);
  return defineConfig({
    tanstackStart: { server: { entry: "server" } },
    // A normal build from this config, never a replacement SDK module or alias.
    // Other modes retain the existing platform target auto-detection.
    ...(config ? { nitro: { preset: "node-server" } } : {}),
  })(environment);
};
