import assert from "assert";
import {
  getPkEntryKpiBreakdownCounts,
  isPkDribbleEntry,
  isPkPassEntry,
  isPkSfgEntry,
} from "./pkEntryKpiBreakdown";

assert.strictEqual(isPkSfgEntry({ entryType: "sfg" }), true);
assert.strictEqual(isPkSfgEntry({ entryType: "SFG" }), true);
assert.strictEqual(isPkSfgEntry({ actionCategory: "sfg" }), true);
assert.strictEqual(isPkSfgEntry({ entryType: "pass" }), false);

assert.strictEqual(isPkDribbleEntry({ entryType: "dribble" }), true);
assert.strictEqual(isPkDribbleEntry({ entryType: "sfg" }), false);
assert.strictEqual(isPkPassEntry({}), true, "brak entryType → pass");
assert.strictEqual(isPkPassEntry({ entryType: "regain" }), false);

const mixed = [
  { entryType: "dribble" as const, isRegain: true },
  { entryType: "dribble" as const, isRegain: false },
  { entryType: "pass" as const, isRegain: true },
  { entryType: "sfg" as const, isRegain: true },
  { entryType: "sfg" as const, isRegain: false },
];
const b = getPkEntryKpiBreakdownCounts(mixed);
assert.strictEqual(b.total, 5);
assert.strictEqual(b.dribbleCount, 2);
assert.strictEqual(b.dribbleRegainCount, 1);
assert.strictEqual(b.passCount, 1);
assert.strictEqual(b.passRegainCount, 1);
assert.strictEqual(b.sfgCount, 2);
assert.ok(b.dribbleRegainCount <= b.dribbleCount);
assert.ok(b.passRegainCount <= b.passCount);

console.log("pkEntryKpiBreakdown.test: OK");
