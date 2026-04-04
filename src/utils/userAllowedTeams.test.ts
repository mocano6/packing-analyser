import assert from "node:assert/strict";
import { normalizeAllowedTeams } from "./userAllowedTeams";

assert.deepEqual(normalizeAllowedTeams(undefined), []);
assert.deepEqual(normalizeAllowedTeams(null), []);
assert.deepEqual(normalizeAllowedTeams("x"), []);
assert.deepEqual(normalizeAllowedTeams({}), []);

const raw: unknown[] = ["a", "", "b", null, 1, "c"];
assert.deepEqual(normalizeAllowedTeams(raw), ["a", "b", "c"]);

assert.deepEqual(normalizeAllowedTeams(["z1", "z2"]), ["z1", "z2"]);

console.log("userAllowedTeams tests: OK");
