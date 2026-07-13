import assert from "node:assert/strict";
import type { Action, TeamInfo } from "@/types";
import {
  buildPxtHalfSummaryForKpi,
  buildPxtZoneRoleActionGroups,
  buildTeamAndOpponentPxtStats,
  getPackingMetrics,
  getTeamPackingActions,
} from "./statystykiZespoluPxtStats";
import { DEFAULT_PXT_PACKING_FILTERS } from "./statystykiZespoluPxtFilters";

function makeAction(overrides: Partial<Action> = {}): Action {
  return {
    id: "a1",
    matchId: "m1",
    minute: 10,
    actionType: "pass",
    packingPoints: 2,
    xTValueStart: 0.01,
    xTValueEnd: 0.05,
    senderId: "p1",
    receiverId: "p2",
    teamId: "team-a",
    ...overrides,
  } as Action;
}

const matchInfo: TeamInfo = {
  matchId: "m1",
  team: "team-a",
  opponent: "team-b",
  date: "2025-01-01",
  matchData: {
    possession: {
      teamFirstHalf: 22,
      teamSecondHalf: 28,
      opponentFirstHalf: 23,
      opponentSecondHalf: 27,
    },
  },
} as TeamInfo;

assert.equal(getPackingMetrics(makeAction()).pxt, 0.08);

const teamOnly = getTeamPackingActions(
  [makeAction({ teamId: "team-a" }), makeAction({ id: "a2", teamId: "team-b" })],
  "team-a",
);
assert.equal(teamOnly.length, 1);

const half = buildPxtHalfSummaryForKpi([
  makeAction({ minute: 20, packingPoints: 1, xTValueStart: 0, xTValueEnd: 0.1 }),
  makeAction({ id: "a2", minute: 60, packingPoints: 2, xTValueStart: 0, xTValueEnd: 0.1 }),
]);
assert.equal(half.firstHalf.pxt, 0.1);
assert.equal(half.secondHalf.pxt, 0.2);

const stats = buildTeamAndOpponentPxtStats(
  [
    makeAction({ teamId: "team-a", packingPoints: 2, xTValueEnd: 0.06, xTValueStart: 0.01 }),
    makeAction({ id: "a2", teamId: "team-b", packingPoints: 1, xTValueEnd: 0.04, xTValueStart: 0.02 }),
  ],
  matchInfo,
  "team-a",
  "all",
  DEFAULT_PXT_PACKING_FILTERS,
);
assert.ok(stats.team.pxt > stats.opponent.pxt);
assert.equal(stats.team.passCount, 1);
assert.ok(stats.team.dominancePct > 50);

const zoneGroups = buildPxtZoneRoleActionGroups(
  [
    makeAction({ id: "pass1", fromZone: "C5", toZone: "D6", actionType: "pass" }),
    makeAction({ id: "recv1", fromZone: "B4", toZone: "C5", actionType: "pass", receiverId: "p3" }),
    makeAction({ id: "drib1", fromZone: "C5", toZone: "C5", actionType: "dribble" }),
  ],
  "C5",
);
assert.equal(zoneGroups[0].actions.length, 1);
assert.equal(zoneGroups[1].actions.length, 1);
assert.equal(zoneGroups[2].actions.length, 1);

console.log("statystykiZespoluPxtStats.test.ts — OK");
