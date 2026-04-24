import assert from "node:assert/strict";
import { filterTeamsByUserAccess, isTeamIdAccessibleForUser, type UserTeamAccess } from "./teamsForUserAccess";

const teams = [
  { id: "a", name: "A" },
  { id: "b", name: "B" },
  { id: "c", name: "C" },
];

const admin: UserTeamAccess = { isAdmin: true, allowedTeamIds: [] };
assert.deepEqual(
  filterTeamsByUserAccess(teams, admin).map((t) => t.id),
  ["a", "b", "c"]
);
assert.equal(isTeamIdAccessibleForUser("x", admin), true);

const u1: UserTeamAccess = { isAdmin: false, allowedTeamIds: ["a", "c"] };
assert.deepEqual(
  filterTeamsByUserAccess(teams, u1).map((t) => t.id),
  ["a", "c"]
);
assert.equal(isTeamIdAccessibleForUser("b", u1), false);
assert.equal(isTeamIdAccessibleForUser("a", u1), true);

const noTeams: UserTeamAccess = { isAdmin: false, allowedTeamIds: [] };
assert.deepEqual(filterTeamsByUserAccess(teams, noTeams), []);
assert.equal(isTeamIdAccessibleForUser("a", noTeams), false);

console.log("teamsForUserAccess tests: OK");
