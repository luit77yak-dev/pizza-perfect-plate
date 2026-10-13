import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import { transform } from "lightningcss";
test("customer CSS compiles and parses in the dev transform, not only production minifier", async () => {
  const css = fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const base = new URL("../", import.meta.url).pathname;
  const compiled = await compile(css, { base, onDependency: () => {} });
  const scanner = new Scanner({ sources: [{ base, pattern: "src/**/*", negated: false }] });
  assert.doesNotThrow(() =>
    transform({ filename: "compiled.css", code: Buffer.from(compiled.build(scanner.scan())) }),
  );
});
