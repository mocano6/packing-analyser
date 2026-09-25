import assert from "assert";
import { microcycleSaveButtonLabel, resolveMicrocycleSaveStatus } from "./microcycleSaveUi";

assert.equal(resolveMicrocycleSaveStatus(true, true), "saving");
assert.equal(resolveMicrocycleSaveStatus(true, false), "saving");
assert.equal(resolveMicrocycleSaveStatus(false, true), "idle");
assert.equal(resolveMicrocycleSaveStatus(false, false), "saved");

assert.equal(microcycleSaveButtonLabel("idle"), "Zapisz");
assert.equal(microcycleSaveButtonLabel("saving"), "Zapisywanie…");
assert.equal(microcycleSaveButtonLabel("saved"), "Zapisano");

console.log("microcycleSaveUi.test.ts: OK");
