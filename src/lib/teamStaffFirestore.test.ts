import assert from "assert";
import { TEAM_STAFF_COLLECTION, teamStaffDocPath } from "./teamStaffFirestore";

assert.strictEqual(
  teamStaffDocPath("team-u19", "trainingMicrocycleState"),
  `teams/team-u19/${TEAM_STAFF_COLLECTION}/trainingMicrocycleState`
);

console.log("teamStaffFirestore.test.ts: OK");
