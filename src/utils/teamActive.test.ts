import assert from "node:assert/strict";
import { isTeamActive } from "./teamActive";

assert.equal(isTeamActive({ inactive: true }), false);
assert.equal(isTeamActive({ inactive: false }), true);
assert.equal(isTeamActive({}), true);
assert.equal(isTeamActive(undefined), false);
assert.equal(isTeamActive(null), false);

console.log("teamActive tests: OK");
