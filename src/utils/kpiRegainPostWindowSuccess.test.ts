import assert from "node:assert/strict";
import type { TeamInfo } from "@/types";
import { buildSuccessfulTeamRegainIds } from "./kpiRegainPostWindowSuccess";

const match: TeamInfo = {
  matchId: "m-regain",
  team: "t1",
  opponent: "opp",
  isHome: true,
  competition: "Liga",
  date: "2026-06-01",
  actions_regain: [
    {
      id: "r-pp",
      matchId: "m-regain",
      teamId: "t1",
      minute: 10,
      actionType: "regain",
      senderId: "p1",
      isSecondHalf: false,
      regainAttackZone: "G7",
      videoTimestamp: 100,
    },
  ],
  shots: [
    {
      id: "s-after",
      matchId: "m-regain",
      teamId: "t1",
      teamContext: "attack",
      playerId: "p2",
      x: 50,
      y: 50,
      minute: 10,
      timestamp: 1,
      xG: 0.2,
      isGoal: false,
      shotType: "on_target",
      actionType: "regain",
      videoTimestamp: 105,
    },
  ],
  pkEntries: [],
  actions_loses: [],
};

const successful = buildSuccessfulTeamRegainIds(match);
assert.equal(successful.has("r-pp"), true);

console.log("kpiRegainPostWindowSuccess.test: ok");
