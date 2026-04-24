import assert from "node:assert/strict";
import {
  normalizeAllowedTeamsForApi,
  playerDocTeamsOverlapAllowed,
} from "./playerSoftDeletePolicy";

assert.deepEqual(normalizeAllowedTeamsForApi(undefined), []);
assert.deepEqual(normalizeAllowedTeamsForApi(["a", "b"]), ["a", "b"]);
assert.deepEqual(normalizeAllowedTeamsForApi("solo"), ["solo"]);

assert.equal(
  playerDocTeamsOverlapAllowed({ teams: ["x"] }, ["y"]),
  false,
);
assert.equal(
  playerDocTeamsOverlapAllowed({ teams: ["x"] }, ["x"]),
  true,
);
assert.equal(
  playerDocTeamsOverlapAllowed({ teamId: "z" }, ["z"]),
  true,
);

console.log("playerSoftDeletePolicy tests: OK");
