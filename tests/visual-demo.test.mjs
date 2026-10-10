import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(
  new URL("../src/features/visual-demo/access.ts", import.meta.url),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;
const { isVisualDemoAllowed: allow } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
for (const [env, expected] of [
  [{}, false],
  [{ NODE_ENV: "production" }, false],
  [{ NODE_ENV: "development" }, true],
  [{ VERCEL_ENV: "production", NODE_ENV: "development" }, false],
  [{ VERCEL_ENV: "preview", NODE_ENV: "production" }, true],
  [{ VERCEL_ENV: "preview", VERCEL_TARGET_ENV: "production" }, false],
  [{ VERCEL: "1", NODE_ENV: "development" }, false],
  [{ VERCEL_ENV: "other", NODE_ENV: "development" }, false],
])
  assert.equal(allow(env), expected, JSON.stringify(env));
// Request headers and hostname cannot authorize the route.
assert.equal(
  allow({ NODE_ENV: "production", HOST: "preview.vercel.app", "x-vercel-env": "preview" }),
  false,
);
console.log("9 server environment authorization assertions passed");
