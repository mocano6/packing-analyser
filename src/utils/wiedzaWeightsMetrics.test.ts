import assert from "node:assert/strict";
import {
  buildWiedzaWeightsCorrelation,
  getWiedzaWeightsMetricsFull,
  WIEDZA_WEIGHTS_METRIC_DEFS,
  WIEDZA_WEIGHTS_METRICS,
} from "./wiedzaWeightsMetrics";
import { TeamInfo } from "../types";

assert.ok(WIEDZA_WEIGHTS_METRIC_DEFS.length >= 28);
const full = getWiedzaWeightsMetricsFull();
assert.equal(full.length, WIEDZA_WEIGHTS_METRICS.length);
assert.ok(full.length >= 45);
assert.ok(full.some((x) => x.id === "w_match_loss"));
assert.ok(full.some((x) => x.id === "w_xt_delta_my"));
assert.ok(full.some((x) => x.id === "w_packing_pts_my"));
assert.ok(full.some((x) => x.id === "w_shots_on_target_my"));
assert.ok(full.some((x) => x.id === "w_shots_blocked_opp"));
assert.ok(full.some((x) => x.id === "w_xpts_my"));
assert.ok(full.some((x) => x.id === "w_xpts_opp"));
assert.equal(
  full.find((x) => x.id === "w_regains_full_pitch_opp")?.label,
  "Straty wł. pp. OPP",
);
assert.equal(full.find((x) => x.id === "w_match_win")?.axisSide, "outcome");
assert.equal(full.find((x) => x.id === "w_match_points")?.label, "Punkty");
assert.equal(full.find((x) => x.id === "w_match_points")?.axisSide, "outcome");
assert.equal(full.find((x) => x.id === "w_goals_my")?.axisSide, "my");
assert.equal(full.find((x) => x.id === "w_goals_opp")?.axisSide, "opp");
assert.equal(
  full.findIndex((x) => x.id === "w_match_points"),
  3,
  "Punkty musi być 4. kolumną, żeby 0 pkt (porażka) nie wypadało z korelacji",
);

// Uproszczone mecze: getTeamGoalsForMatch etc. wymagają shots — jeden mecz z danymi
const matchWithStats = (goalsA: number, goalsD: number, xgSumA: number, xgSumD: number): TeamInfo => {
  const attackShots = Array.from({ length: Math.max(1, goalsA) }, (_, i) => ({
    id: `sa${i}`,
    x: 50,
    y: 50,
    minute: i,
    xG: i === 0 ? xgSumA : 0,
    isGoal: i < goalsA,
    matchId: "m",
    timestamp: i,
    shotType: "on_target" as const,
    teamContext: "attack" as const,
    teamId: "t1",
  }));
  const defShots = Array.from({ length: Math.max(1, goalsD) }, (_, i) => ({
    id: `sd${i}`,
    x: 50,
    y: 50,
    minute: 20 + i,
    xG: i === 0 ? xgSumD : 0,
    isGoal: i < goalsD,
    matchId: "m",
    timestamp: 20 + i,
    shotType: "on_target" as const,
    teamContext: "defense" as const,
    teamId: "op",
  }));
  return {
    team: "t1",
    opponent: "op",
    isHome: true,
    competition: "L",
    date: "2026-01-01",
    shots: [...attackShots, ...defShots],
    matchData: {},
  } as TeamInfo;
};

const three = [
  matchWithStats(1, 0, 0.5, 0.2),
  matchWithStats(2, 1, 0.8, 0.4),
  matchWithStats(0, 2, 0.3, 1.1),
];

const pointsMetric = full.find((x) => x.id === "w_match_points");
assert.ok(pointsMetric);
assert.equal(pointsMetric.getValue(three[0]), 3);
assert.equal(pointsMetric.getValue(three[1]), 3);
assert.equal(pointsMetric.getValue(three[2]), 0);

const res = buildWiedzaWeightsCorrelation(three, 3);
assert.ok(res != null);
assert.equal(res!.matrix.length, full.length);
const pointsIdx = res!.metrics.findIndex((m) => m.id === "w_match_points");
const winIdx = res!.metrics.findIndex((m) => m.id === "w_match_win");
assert.ok(pointsIdx >= 0 && winIdx >= 0);
assert.equal(typeof res!.matrix[pointsIdx][winIdx], "number");

console.log("wiedzaWeightsMetrics tests: OK");
