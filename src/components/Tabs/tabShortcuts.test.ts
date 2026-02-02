import assert from "node:assert/strict";
import { getTabForShortcutKey } from "./tabShortcuts";

assert.equal(getTabForShortcutKey("q"), "acc8s");
assert.equal(getTabForShortcutKey("w"), "pk_entries");
assert.equal(getTabForShortcutKey("e"), "xg");
assert.equal(getTabForShortcutKey("r"), "packing");
assert.equal(getTabForShortcutKey("t"), "regain_loses");
assert.equal(getTabForShortcutKey("Q"), "acc8s");

assert.equal(getTabForShortcutKey("1"), null);
assert.equal(getTabForShortcutKey("a"), null);

console.log("tabShortcuts tests: OK");

