import assert from "node:assert/strict";
import {
  staffAllowedToUpdatePlayer,
  staffAllowedToCreatePlayer,
  normalizeTeamsFieldOnly,
} from "./playerSavePolicy";

assert.deepEqual(normalizeTeamsFieldOnly([" a ", "b"]), ["a", "b"]);
assert.deepEqual(normalizeTeamsFieldOnly("x"), ["x"]);

const allowed = ["t1", "t2"];
assert.equal(
  staffAllowedToUpdatePlayer({ teams: ["t1"] }, { teams: ["t2"] }, allowed),
  true,
);
assert.equal(
  staffAllowedToUpdatePlayer({ teams: ["t1"] }, { teams: ["other"] }, allowed),
  false,
);
assert.equal(
  staffAllowedToUpdatePlayer({ teams: ["t1"] }, { name: "x" }, allowed),
  true,
);
assert.equal(staffAllowedToCreatePlayer({ teams: ["t1"] }, allowed), true);
assert.equal(staffAllowedToCreatePlayer({ teams: ["x"] }, allowed), false);
assert.equal(staffAllowedToCreatePlayer({ teams: [] }, allowed), false);

console.log("playerSavePolicy tests: OK");
