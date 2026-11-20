import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handleClosedPrivateTracking } from "../src/server/private-tracking-closed.ts";

const endpoint = "https://a.synthetic.invalid/api/order-track";
const request = (auth = "Bearer " + "a".repeat(43)) => new Request(endpoint, {
  method: "POST",
  headers: { Origin: "https://a.synthetic.invalid", "Content-Type": "application/json", Authorization: auth },
  body: JSON.stringify({ order_id: "91000000-0000-4000-8000-000000000103" }),
});

test("default production boundary denies tracking with 503 even with valid-looking token", async () => {
  const response = await handleClosedPrivateTracking(request());
  assert.equal(response.status, 503);
  assert.match(response.headers.get("Cache-Control") ?? "", /no-store/);
  assert.equal(response.headers.get("Set-Cookie"), null);
  const body = await response.text();
  assert.doesNotMatch(body, /Bearer|91000000-0000-4000-8000-000000000103/);
});

test("disabled tracking boundary does not depend on an environment flag", async () => {
  const previous = process.env.NEROXA_TRACKING_ENABLED;
  try {
    process.env.NEROXA_TRACKING_ENABLED = "true";
    const response = await handleClosedPrivateTracking(request());
    assert.equal(response.status, 503);
  } finally {
    if (previous === undefined) delete process.env.NEROXA_TRACKING_ENABLED;
    else process.env.NEROXA_TRACKING_ENABLED = previous;
  }
});

test("route cannot import hosted-admission, admin client or permissive tracking handler", () => {
  const src = readFileSync("src/routes/api/order-track.ts", "utf8");
  const adapter = readFileSync("src/server/private-tracking-closed.ts", "utf8");
  const tokenHolder = readFileSync("src/lib/domain/private-tracking-capability.ts", "utf8");
  assert.match(src, /handleClosedPrivateTracking\(request\)/);
  assert.doesNotMatch(src + adapter, /supabaseAdmin|SERVICE_ROLE|hosted-admission|privateTrackingDependencies/);
  assert.match(adapter, /enabled:\s*false/);
  assert.doesNotMatch(tokenHolder, /localStorage|sessionStorage|document\.cookie/);
});
