import assert from "node:assert/strict";
import { planPlayerTeamRemoval } from "./playerTeamRemoval";

const not = planPlayerTeamRemoval({ teams: ["a"] }, "z");
assert.equal(not.ok, false);
if (!not.ok) {
  assert.equal(not.code, "not_member");
}

const yes = planPlayerTeamRemoval({ teams: ["  x  ", "y"], team: "y" }, "y");
assert.equal(yes.ok, true);
if (yes.ok) {
  assert.deepEqual(yes.nextTeamsStored, ["  x  "]);
  assert.equal(yes.deleteTeamField, true);
}

console.log("playerTeamRemoval tests: OK");
