import assert from "node:assert/strict";
import { filterMatchActionsBySelectedTeam } from "./filterMatchActionsByTeam";

const actions = [{ teamId: "a" }, { teamId: "b" }];
assert.strictEqual(filterMatchActionsBySelectedTeam(actions, ""), actions);
assert.strictEqual(filterMatchActionsBySelectedTeam(actions, undefined), actions);

const mixed = [{ teamId: "home" }, { teamId: undefined }, { teamId: "away" }];
assert.deepEqual(filterMatchActionsBySelectedTeam(mixed, "home"), [
  { teamId: "home" },
]);

const onlyAway = [{ teamId: "away" }, { teamId: "away" }];
assert.deepEqual(filterMatchActionsBySelectedTeam(onlyAway, "home"), []);

const legacyOnly = [{ teamId: undefined }, {}];
assert.deepEqual(filterMatchActionsBySelectedTeam(legacyOnly, "home"), legacyOnly);

console.log("filterMatchActionsByTeam tests: OK");
