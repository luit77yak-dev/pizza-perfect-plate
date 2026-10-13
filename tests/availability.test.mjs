import test from "node:test";
import assert from "node:assert/strict";
import { parseAvailability } from "../src/core/delivery/availability.ts";
const value = {
  contract: "INSTANCE_AVAILABILITY_V1",
  instance_id: "A1",
  configured: true,
  open: true,
  timezone: "America/Sao_Paulo",
  checked_at: "2026-10-13T13:00:00Z",
};
test("availability belongs to the selected store and fails closed for missing/malformed data", () => {
  assert.equal(parseAvailability(value, "A1").open, true);
  assert.equal(parseAvailability({ ...value, open: false }, "A1").open, false);
  assert.equal(parseAvailability(value, "A2"), null);
  assert.equal(parseAvailability(null, "A1"), null);
  assert.equal(parseAvailability({ ...value, timezone: "Not/AZone" }, "A1"), null);
  assert.equal(parseAvailability({ ...value, configured: false }, "A1"), null);
});
