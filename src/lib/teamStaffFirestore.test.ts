import assert from "assert";
import { TEAM_STAFF_COLLECTION, teamStaffDocPath } from "./teamStaffFirestore";

assert.strictEqual(
  teamStaffDocPath("team-u19", "trainingMicrocycleState"),
  `teams/team-u19/${TEAM_STAFF_COLLECTION}/trainingMicrocycleState`
);
assert.strictEqual(
  teamStaffDocPath("team-u19", "gameModelState"),
  `teams/team-u19/${TEAM_STAFF_COLLECTION}/gameModelState`
);
assert.strictEqual(
  teamStaffDocPath("team-u19", "positionSystemState"),
  `teams/team-u19/${TEAM_STAFF_COLLECTION}/positionSystemState`
);

console.log("teamStaffFirestore.test.ts: OK");
