import assert from "node:assert/strict";
import {
  buildAggregatedLosesZoneHeatmap,
  buildAggregatedRegainZoneHeatmap,
  collectLosesActionsFromWiedzaMatches,
  collectRegainActionsFromWiedzaMatches,
} from "./wiedzaZoneHeatmaps";
import { TeamInfo } from "../types";

const match: TeamInfo = {
  team: "t1",
  opponent: "op",
  isHome: true,
  competition: "L",
  date: "2026-01-01",
  matchData: {},
  actions_regain: [
    {
      id: "r1",
      matchId: "m",
      teamId: "t1",
      minute: 1,
      actionType: "regain",
      senderId: "p1",
      isSecondHalf: false,
      regainAttackZone: "D6",
      regainDefenseZone: "B3",
    } as any,
  ],
  actions_loses: [
    {
      id: "l1",
      matchId: "m",
      teamId: "t1",
      minute: 2,
      actionType: "lose",
      senderId: "p1",
      isSecondHalf: false,
      losesAttackZone: "E7",
    } as any,
  ],
};

assert.equal(collectRegainActionsFromWiedzaMatches([match]).length, 1);
assert.equal(collectLosesActionsFromWiedzaMatches([match]).length, 1);

const regAll = buildAggregatedRegainZoneHeatmap([match], "all", "count", "attack");
assert.equal(regAll.get("D6"), 1);

const loseAll = buildAggregatedLosesZoneHeatmap([match], "all", "count", "attack");
assert.equal(loseAll.get("E7"), 1);

console.log("wiedzaZoneHeatmaps tests: OK");
