import assert from "node:assert/strict";
import { buildTeamQualityIndexModel } from "./teamQualityIndex";
import type { TeamInfo } from "@/types";

const baseMatch = (team: string, idx: number, goalsFor: number, goalsAgainst: number, xgFor: number, xgAgainst: number): TeamInfo => ({
  matchId: `${team}_${idx}`,
  team,
  opponent: `opp_${idx}`,
  isHome: true,
  competition: "Liga",
  date: `2026-05-${String(idx + 1).padStart(2, "0")}`,
  shots: [
    {
      id: `${team}_${idx}_gf`,
      matchId: `${team}_${idx}`,
      teamContext: "attack",
      teamId: team,
      minute: 10,
      timestamp: 10,
      shotType: goalsFor > 0 ? "goal" : "off_target",
      xG: xgFor,
      isGoal: goalsFor > 0,
      x: 0,
      y: 0,
    },
    {
      id: `${team}_${idx}_ga`,
      matchId: `${team}_${idx}`,
      teamContext: "defense",
      teamId: `opp_${idx}`,
      minute: 20,
      timestamp: 20,
      shotType: goalsAgainst > 0 ? "goal" : "off_target",
      xG: xgAgainst,
      isGoal: goalsAgainst > 0,
      x: 0,
      y: 0,
    },
  ],
  actions_packing: Array.from({ length: Math.max(0, goalsFor + 1) }, (_, actionIdx) => ({
    id: `${team}_${idx}_p_${actionIdx}`,
    actionType: "pass",
    teamId: team,
    matchId: `${team}_${idx}`,
    minute: 1,
    timestamp: actionIdx,
    senderId: "p1",
    isSecondHalf: false,
    packingPoints: goalsFor + 1,
    xTValueStart: 0,
    xTValueEnd: 0.1,
    startZone: "P7",
    endZone: "P10",
  })),
  actions_regain: [],
  actions_loses: [],
});

const matches = [
  baseMatch("alpha", 1, 2, 0, 1.8, 0.4),
  baseMatch("alpha", 2, 1, 0, 1.5, 0.6),
  baseMatch("alpha", 3, 2, 1, 2.0, 0.8),
  baseMatch("beta", 1, 0, 2, 0.4, 1.7),
  baseMatch("beta", 2, 0, 1, 0.6, 1.4),
  baseMatch("beta", 3, 1, 2, 0.8, 1.9),
];

const model = buildTeamQualityIndexModel(
  matches,
  new Map([
    ["alpha", "Alpha FC"],
    ["beta", "Beta FC"],
  ]),
);

assert.ok(model);
assert.equal(model.rows.length, 2);
assert.equal(model.rows[0].teamName, "Alpha FC");
assert.equal(model.rows[0].qualityIndex, 100);
assert.equal(model.rows[1].qualityIndex, 0);
assert.equal(model.usedCorrelationWeights, true);
assert.ok(model.weights.some((weight) => weight.id === "xgd" && weight.correlation !== null));
