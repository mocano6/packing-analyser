import assert from "node:assert";
import {
  getDefaultPlayerComparisonDateRange,
  toDateInputValueLocal,
} from "./playerComparisonDateDefaults";

assert.strictEqual(
  toDateInputValueLocal(new Date(2026, 4, 6)),
  "2026-05-06",
);

const fixed = new Date(2026, 4, 6, 12, 0, 0);
const range = getDefaultPlayerComparisonDateRange(fixed);
assert.strictEqual(range.to, "2026-05-06");
assert.strictEqual(range.from, "2026-02-06");

console.log("playerComparisonDateDefaults.test: OK");
