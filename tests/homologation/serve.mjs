import fs from "node:fs";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
const root = new URL("../../", import.meta.url).pathname;
const work = process.env.HOMOLOGATION_WORKDIR;
if (!work || !fs.statSync(work).isDirectory())
  throw Error("Private temporary HOMOLOGATION_WORKDIR required");
if (fs.existsSync(root + "/vite.homologation.config.ts"))
  throw Error("Refusing to overwrite existing temporary config");
execFileSync(
  "openssl",
  [
    "req",
    "-new",
    "-x509",
    "-nodes",
    "-newkey",
    "rsa:2048",
    "-keyout",
    work + "/key.pem",
    "-out",
    work + "/cert.pem",
    "-days",
    "1",
    "-subj",
    "/CN=a.ab.invalid",
    "-addext",
    "subjectAltName=DNS:a.ab.invalid,DNS:b.ab.invalid,DNS:c.ab.invalid",
  ],
  { stdio: "ignore" },
);
fs.chmodSync(work + "/key.pem", 0o600);
const local = {}; // This runner is strictly mock-transport UI QA; never enable a backend.
if (local.API_URL && !["localhost", "127.0.0.1"].includes(new URL(local.API_URL).hostname))
  throw Error("Local only");
fs.writeFileSync(
  root + "/vite.homologation.config.ts",
  `import {defineConfig} from '@lovable.dev/vite-tanstack-config';import {readFileSync} from 'node:fs';export default defineConfig({tanstackStart:{server:{entry:'server'}},vite:{resolve:{alias:[{find:'@/integrations/storefront-backend/client',replacement:'${root}/tests/homologation/client.fixture.ts'}]},server:{host:'127.0.0.1',port:4173,strictPort:true,allowedHosts:['a.ab.invalid','b.ab.invalid','c.ab.invalid'],https:{key:readFileSync('${work}/key.pem'),cert:readFileSync('${work}/cert.pem')}}}});`,
);
const env = {
  ...process.env,
  VITE_NEROXA_GROUP_ADDONS_V1: "true",
  VITE_NEROXA_CHECKOUT_GATEWAY: "true",
  VITE_NEROXA_CHECKOUT_AMENDMENTS: "true",
  NEROXA_GROUP_ADDONS_V1_ENABLED: "true",
  NEROXA_CHECKOUT_GATEWAY_ENABLED: local.API_URL ? "true" : "false",
  NEROXA_CHECKOUT_AMENDMENTS_ENABLED: local.API_URL ? "true" : "false",
  SUPABASE_URL: local.API_URL ?? "http://127.0.0.1:54321",
  NEROXA_DELIVERY_BACKEND_URL: local.API_URL ?? "http://127.0.0.1:54321",
  SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY ?? "synthetic-disabled",
  SUPABASE_PUBLISHABLE_KEY: local.ANON_KEY ?? "synthetic-disabled",
  NEROXA_CHECKOUT_RATE_LIMIT_SECRET: crypto.randomBytes(48).toString("hex"),
};
const fd = fs.openSync(work + "/vite.private.log", "a", 0o600);
const child = spawn(
  process.execPath,
  [root + "/node_modules/vite/bin/vite.js", "--config", "vite.homologation.config.ts"],
  { cwd: root, env, stdio: ["ignore", fd, fd] },
);
fs.writeFileSync(work + "/vite.pid", String(child.pid));
process.on("SIGTERM", () => child.kill());
await new Promise((r) => child.on("exit", r));
fs.rmSync(root + "/vite.homologation.config.ts", { force: true });
fs.closeSync(fd);
