import assert from "node:assert/strict";
import type { Action } from "@/types";
import {
  buildLosesZoneContextActionGroups,
  buildTeamLosesStats,
  isLoseAttackContext,
} from "./statystykiZespoluLosesStats";

function action(overrides: Partial<Action> = {}): Action {
  return {
    id: "a1",
    matchId: "m1",
    teamId: "t1",
    minute: 20,
    actionType: "lose",
    senderId: "p1",
    isSecondHalf: false,
    losesAttackZone: "H8",
    losesAttackXT: 0.05,
    losesDefenseXT: 0.01,
    ...overrides,
  };
}

assert.equal(isLoseAttackContext(action()), true);
assert.equal(isLoseAttackContext(action({ losesAttackZone: "C5" })), false);

const stats = buildTeamLosesStats([action(), action({ id: "a2", losesAttackZone: "C5", losesAttackXT: 0.08, losesDefenseXT: 0.03 })], "all", []);
assert.equal(stats.visibleLosesCount, 2);
assert.equal(stats.losesAttackCount, 2);
assert.equal(stats.losesDefenseCount, 2);
assert.ok(Math.abs(stats.losesXTInAttack - 0.13) < 1e-9);
assert.ok(Math.abs(stats.losesXTInDefense - 0.04) < 1e-9);

const zoneGroups = buildLosesZoneContextActionGroups(
  [
    action({ id: "a1", losesAttackZone: "H8" }),
    action({ id: "a2", losesAttackZone: "H8", minute: 30 }),
  ],
  "H8",
  "all",
  [],
);
assert.equal(zoneGroups[0].actions.length, 2);
assert.equal(zoneGroups[1].actions.length, 0);

console.log("statystykiZespoluLosesStats.test.ts: OK");
