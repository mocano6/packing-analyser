import assert from "node:assert/strict";
import {
  count8sCaShotForBreakdown,
  isPkEntryFromRegainSequence,
  isShotFromRegainSequence,
} from "./kpiRegainSequenceFlags";

assert.equal(isShotFromRegainSequence(null), false);
assert.equal(isShotFromRegainSequence(undefined), false);
assert.equal(isShotFromRegainSequence("x"), false);
assert.equal(isShotFromRegainSequence({ actionType: "regain" }), true);
assert.equal(isShotFromRegainSequence({ actionType: "open_play", isRegain: true }), true);
assert.equal(isShotFromRegainSequence({ actionType: "open_play" }), false);

assert.equal(isPkEntryFromRegainSequence(null), false);
assert.equal(isPkEntryFromRegainSequence(undefined), false);
assert.equal(isPkEntryFromRegainSequence({ isRegain: true, entryType: "pass" }), true);
assert.equal(isPkEntryFromRegainSequence({ entryType: "regain" }), true);
assert.equal(isPkEntryFromRegainSequence({ actionType: "regain" }), true);
assert.equal(isPkEntryFromRegainSequence({ entryType: "pass" }), false);

assert.equal(count8sCaShotForBreakdown(false, 10, true, { isShot: true }, 5), false);
assert.equal(count8sCaShotForBreakdown(true, 10, false, {}, undefined), true);
assert.equal(count8sCaShotForBreakdown(true, 10, true, { isShot: false }, 5), true);
assert.equal(count8sCaShotForBreakdown(true, 4, true, { isShot: true }, 10), true);
assert.equal(count8sCaShotForBreakdown(true, 12, true, { isShot: true }, 10), false);
assert.equal(count8sCaShotForBreakdown(true, 10, true, { isShot: true }, 10), false);

console.log("kpiRegainSequenceFlags tests: OK");
