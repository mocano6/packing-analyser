import assert from "node:assert/strict";
import type { Action } from "@/types";
import {
  buildRegainZoneContextActionGroups,
  buildTeamRegainStats,
  buildRegainPlayerRows,
} from "./statystykiZespoluRegainStats";

function action(overrides: Partial<Action> = {}): Action {
  return {
    id: "a1",
    matchId: "m1",
    teamId: "t1",
    minute: 20,
    actionType: "regain",
    senderId: "p1",
    isSecondHalf: false,
    regainAttackZone: "H8",
    regainDefenseZone: "A8",
    regainAttackXT: 0.05,
    regainDefenseXT: 0.01,
    isP2: true,
    ...overrides,
  };
}

const stats = buildTeamRegainStats([action(), action({ id: "a2", senderId: "p2", isP3: true })], "all", []);
assert.equal(stats.totalRegains, 2);
assert.equal(stats.visibleRegainsCount, 2);
assert.equal(stats.regainAttackCount, 2);
assert.equal(stats.regainDefenseCount, 2);
assert.ok(Math.abs(stats.regainXTInAttack - 0.1) < 1e-9);
assert.ok(Math.abs(stats.regainXTInDefense - 0.02) < 1e-9);

const players = buildRegainPlayerRows([action()], 1, (id) => id);
assert.equal(players.length, 1);
assert.equal(players[0].p2Count, 1);

const zoneGroups = buildRegainZoneContextActionGroups(
  [
    action({ id: "a1", regainAttackZone: "H8", regainDefenseXT: 0.01 }),
    action({ id: "a2", regainAttackZone: "H8", regainDefenseXT: 0.05, isAttack: false }),
  ],
  "H8",
  "all",
  [],
);
assert.equal(zoneGroups[0].actions.length, 1);
assert.equal(zoneGroups[1].actions.length, 1);

console.log("statystykiZespoluRegainStats.test.ts: OK");
