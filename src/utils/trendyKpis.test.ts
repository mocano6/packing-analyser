import assert from "node:assert/strict";
import {
  buildPearsonCorrelationMatrix,
  calculateTrendyKpiValue,
  correlationMatrixRowOrder,
  correlationMatrixRowOrderByReferenceColumn,
  formatKpiValue,
  pearsonCorrelation,
  permuteSquareCorrelationMatrix,
  getDeadTimeMinutes,
  getDeadTimePct,
  getTeamPossessionMinutes,
  getTeamPossessionPct,
  getOpponentPossessionMinutes,
  getOpponentPossessionPct,
  getOpponentXGForMatch,
  getTeamGoalsForMatch,
  getOpponentGoalsForMatch,
  getTeamMatchPointsForMatch,
  getTeamMatchWinIndicatorForMatch,
  getTeamMatchDrawIndicatorForMatch,
  getTeamMatchLossIndicatorForMatch,
  getTeamShotsCountForMatch,
  getTeamShotsOnTargetCountForMatch,
  getTeamShotsBlockedCountForMatch,
  getOpponentShotsOnTargetCountForMatch,
  getOpponentShotsBlockedCountForMatch,
  getTeamPKEntriesCountForMatch,
  getOpponentShotsCountForMatch,
  getOpponentPKEntriesCountForMatch,
  getTeamXgPerShotForMatch,
  getTeamGoalsPerShotForMatch,
  getOpponentGoalsPerShotForMatch,
  getRegainsFullPitchCount,
  getLosesFullPitchCount,
  getOpponentXgPerShot,
  getTeamXgForMatch,
  getTeamLosesInPMAreaCountForMatch,
  getTeamRegainsInPMAreaCountForMatch,
  getTeamCounterpress5sPctForMatch,
  getTeamRegainsOpponentHalfCountForMatch,
  getOpponentRegainsOurHalfCountForMatch,
  getTeamLosesOwnHalfNonAutCountForMatch,
  getTeamP2CountForMatch,
  getTeamP3CountForMatch,
  getTeamPxtForMatch,
  getTeamXtDeltaSumForMatch,
  getTeamPackingPointsSumForMatch,
} from "./trendyKpis";
import { TeamInfo } from "../types";

const sampleMatch: TeamInfo = {
  team: "t1",
  opponent: "Rywale",
  isHome: true,
  competition: "Liga",
  date: "2026-03-01",
  shots: [
    { id: "s1", x: 50, y: 50, minute: 10, xG: 0.2, isGoal: true, matchId: "m1", timestamp: 1, shotType: "on_target", teamContext: "attack", teamId: "t1", isContact1: true },
    { id: "s2", x: 52, y: 52, minute: 20, xG: 0.1, isGoal: false, matchId: "m1", timestamp: 2, shotType: "off_target", teamContext: "attack", teamId: "t1" },
    { id: "s3", x: 52, y: 52, minute: 30, xG: 0.5, isGoal: true, matchId: "m1", timestamp: 3, shotType: "off_target", teamContext: "defense", teamId: "op" },
  ],
  pkEntries: [
    { id: "pk1", matchId: "m1", teamId: "t1", startX: 1, startY: 1, endX: 2, endY: 2, minute: 2, isSecondHalf: false, teamContext: "attack", timestamp: 1 },
    { id: "pk2", matchId: "m1", teamId: "op", startX: 1, startY: 1, endX: 2, endY: 2, minute: 2, isSecondHalf: false, teamContext: "defense", timestamp: 1 },
  ],
  actions_loses: [
    { id: "l1", matchId: "m1", teamId: "t1", minute: 1, actionType: "lose", senderId: "p1", isSecondHalf: false, isReaction5s: true },
    { id: "l2", matchId: "m1", teamId: "t1", minute: 2, actionType: "lose", senderId: "p1", isSecondHalf: false, isBadReaction5s: true },
  ],
  matchData: {
    possession: {
      teamFirstHalf: 20,
      teamSecondHalf: 15,
      opponentFirstHalf: 10,
      opponentSecondHalf: 10,
      deadFirstHalf: 5,
      deadSecondHalf: 5,
    },
  },
};

assert.ok(Math.abs(calculateTrendyKpiValue(sampleMatch, "xg_for") - 0.3) < 1e-9);
assert.ok(Math.abs(getOpponentXGForMatch(sampleMatch) - 0.5) < 1e-9);
assert.equal(getTeamGoalsForMatch(sampleMatch), 1);
assert.equal(getOpponentGoalsForMatch(sampleMatch), 1);
assert.equal(getTeamMatchPointsForMatch(sampleMatch), 1);
assert.equal(getTeamMatchWinIndicatorForMatch(sampleMatch), 0);
assert.equal(getTeamMatchDrawIndicatorForMatch(sampleMatch), 1);
assert.equal(getTeamMatchLossIndicatorForMatch(sampleMatch), 0);
assert.equal(
  getTeamMatchWinIndicatorForMatch(sampleMatch) +
    getTeamMatchDrawIndicatorForMatch(sampleMatch) +
    getTeamMatchLossIndicatorForMatch(sampleMatch),
  1,
);

const lossMatch: TeamInfo = {
  team: "t1",
  opponent: "op",
  isHome: true,
  competition: "L",
  date: "2026-03-02",
  shots: [
    {
      id: "og",
      x: 50,
      y: 50,
      minute: 10,
      xG: 0.4,
      isGoal: true,
      matchId: "m2",
      timestamp: 1,
      shotType: "goal" as const,
      teamContext: "defense" as const,
      teamId: "op",
    },
  ],
} as TeamInfo;
assert.equal(getTeamMatchLossIndicatorForMatch(lossMatch), 1);
assert.equal(getTeamMatchWinIndicatorForMatch(lossMatch), 0);
assert.equal(getTeamMatchDrawIndicatorForMatch(lossMatch), 0);
assert.equal(calculateTrendyKpiValue(sampleMatch, "shots_for"), 2);
assert.equal(getTeamShotsCountForMatch(sampleMatch), 2);
assert.equal(getOpponentShotsCountForMatch(sampleMatch), 1);
assert.equal(getTeamShotsOnTargetCountForMatch(sampleMatch), 1);
assert.equal(getOpponentShotsOnTargetCountForMatch(sampleMatch), 1);
assert.equal(getTeamShotsBlockedCountForMatch(sampleMatch), 0);
assert.equal(getOpponentShotsBlockedCountForMatch(sampleMatch), 0);
assert.equal(calculateTrendyKpiValue(sampleMatch, "pk_opponent"), 1);
assert.equal(getTeamPKEntriesCountForMatch(sampleMatch), calculateTrendyKpiValue(sampleMatch, "pk_for"));
assert.equal(getOpponentPKEntriesCountForMatch(sampleMatch), calculateTrendyKpiValue(sampleMatch, "pk_opponent"));
assert.ok(Math.abs(calculateTrendyKpiValue(sampleMatch, "xg_per_shot") - 0.15) < 1e-9);
assert.ok(Math.abs(getTeamXgPerShotForMatch(sampleMatch) - calculateTrendyKpiValue(sampleMatch, "xg_per_shot")) < 1e-9);
assert.ok(Math.abs(getTeamGoalsPerShotForMatch(sampleMatch) - 0.5) < 1e-9);
assert.ok(Math.abs(getOpponentGoalsPerShotForMatch(sampleMatch) - 1) < 1e-9);
assert.equal(calculateTrendyKpiValue(sampleMatch, "counterpress_5s_pct"), 50);
assert.equal(
  getTeamCounterpress5sPctForMatch(sampleMatch),
  calculateTrendyKpiValue(sampleMatch, "counterpress_5s_pct"),
);
assert.equal(getTeamXgForMatch(sampleMatch), calculateTrendyKpiValue(sampleMatch, "xg_for"));
assert.ok(getRegainsFullPitchCount(sampleMatch) >= 0);
assert.ok(getLosesFullPitchCount(sampleMatch) >= 1);
assert.ok(getOpponentXgPerShot(sampleMatch) >= 0);

const pmZonesMatch: TeamInfo = {
  team: "t1",
  opponent: "op",
  isHome: true,
  competition: "L",
  date: "2026-01-02",
  shots: [],
  actions_loses: [
    {
      id: "l1",
      matchId: "m",
      teamId: "t1",
      minute: 1,
      actionType: "lose",
      senderId: "p1",
      isSecondHalf: false,
      losesAttackZone: "D6",
    },
    {
      id: "l2",
      matchId: "m",
      teamId: "op",
      minute: 2,
      actionType: "lose",
      senderId: "p2",
      isSecondHalf: false,
      losesAttackZone: "E7",
    },
    {
      id: "l3",
      matchId: "m",
      teamId: "t1",
      minute: 3,
      actionType: "lose",
      senderId: "p1",
      isSecondHalf: false,
      losesAttackZone: "A1",
    },
    {
      id: "l4",
      matchId: "m",
      teamId: "t1",
      minute: 4,
      actionType: "lose",
      senderId: "p1",
      isSecondHalf: false,
      isAut: true,
      losesAttackZone: "D6",
    },
  ],
  actions_regain: [
    {
      id: "r1",
      matchId: "m",
      teamId: "t1",
      minute: 5,
      actionType: "regain",
      senderId: "p1",
      isSecondHalf: false,
      regainAttackZone: "F8",
    },
    {
      id: "r2",
      matchId: "m",
      teamId: "op",
      minute: 6,
      actionType: "regain",
      senderId: "p2",
      isSecondHalf: false,
      regainAttackZone: "C5",
    },
    {
      id: "r3",
      matchId: "m",
      teamId: "t1",
      minute: 7,
      actionType: "regain",
      senderId: "p1",
      isSecondHalf: false,
      regainAttackZone: "A1",
    },
  ],
} as TeamInfo;
assert.equal(getTeamLosesInPMAreaCountForMatch(pmZonesMatch), 1);
assert.equal(getTeamRegainsInPMAreaCountForMatch(pmZonesMatch), 1);

const halfGridMatch: TeamInfo = {
  team: "t1",
  opponent: "op",
  isHome: true,
  competition: "L",
  date: "2026-01-04",
  shots: [],
  actions_regain: [
    {
      id: "rOpp",
      matchId: "m",
      teamId: "t1",
      minute: 1,
      actionType: "regain",
      senderId: "p1",
      isSecondHalf: false,
      regainAttackZone: "D12",
    },
    {
      id: "rOppOur",
      matchId: "m",
      teamId: "op",
      minute: 2,
      actionType: "regain",
      senderId: "p2",
      isSecondHalf: false,
      regainDefenseZone: "B4",
    },
  ],
  actions_loses: [
    {
      id: "lOwn",
      matchId: "m",
      teamId: "t1",
      minute: 3,
      actionType: "lose",
      senderId: "p1",
      isSecondHalf: false,
      losesAttackZone: "E2",
      isAut: false,
    },
    {
      id: "lOppHalf",
      matchId: "m",
      teamId: "t1",
      minute: 4,
      actionType: "lose",
      senderId: "p1",
      isSecondHalf: false,
      losesAttackZone: "F10",
      isAut: false,
    },
  ],
} as TeamInfo;
assert.equal(getTeamRegainsOpponentHalfCountForMatch(halfGridMatch), 1);
assert.equal(getOpponentRegainsOurHalfCountForMatch(halfGridMatch), 1);
assert.equal(getTeamLosesOwnHalfNonAutCountForMatch(halfGridMatch), 1);

assert.equal(formatKpiValue(55.55, "percent"), "55.5%");
assert.equal(formatKpiValue(0.156, "ratio"), "0.16");

assert.ok(Math.abs((pearsonCorrelation([1, 2, 3], [2, 4, 6], 2) ?? 0) - 1) < 1e-9);
assert.ok(Math.abs((pearsonCorrelation([1, 2, 3], [3, 2, 1], 2) ?? 0) + 1) < 1e-9);
assert.equal(pearsonCorrelation([1, 1, 1], [2, 3, 4], 2), null);
assert.equal(pearsonCorrelation([1, 2], [2, 4], 3), null);

assert.ok(
  Math.abs((pearsonCorrelation([0, 1, 2, 3], [0, 2, 4, 6], 2, { omitZeroValues: true }) ?? 0) - 1) < 1e-9,
);
assert.ok(
  pearsonCorrelation([0, 1, 0, 1], [2, 4, 6, 8], 3, {
    omitZeroValues: true,
    zeroIsValidForX: true,
    zeroIsValidForY: false,
  }) != null,
);
assert.equal(pearsonCorrelation([0, 0, 1], [0, 0, 2], 2, { omitZeroValues: true }), null);
assert.ok(
  Math.abs((pearsonCorrelation([Number.NaN, 1, 2], [3, 4, 5], 2) ?? 0) - 1) < 1e-9,
);

const m = buildPearsonCorrelationMatrix(
  [
    [1, 2, 3],
    [2, 4, 6],
    [10, 8, 6],
  ],
  3,
);
assert.ok(m[0][0] != null && Math.abs(m[0][0] - 1) < 1e-9);
assert.ok(m[0][1] != null && Math.abs(m[0][1] - 1) < 1e-9);
assert.ok(m[0][2] != null && m[0][2]! < 0);

const labelsPl = ["Zebra", "Aback", "Ćma"];
const orderAlpha = correlationMatrixRowOrder(
  labelsPl,
  [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  "alpha_pl",
);
assert.deepEqual(orderAlpha, [1, 2, 0]);

// Sort po kolumnie 0: malejąco — najpierw najsilniejsza korelacja z metryką 0
const colSortMat: (number | null)[][] = [
  [null, 0.1, 0.2],
  [0.1, null, 0.3],
  [0.2, 0.3, null],
];
const ordDesc = correlationMatrixRowOrderByReferenceColumn(colSortMat, 0, "desc");
assert.deepEqual(ordDesc, [0, 2, 1]);
const ordAsc = correlationMatrixRowOrderByReferenceColumn(colSortMat, 0, "asc");
assert.deepEqual(ordAsc, [1, 2, 0]);

const mat: number[][] = [
  [1, 2],
  [3, 4],
];
assert.deepEqual(permuteSquareCorrelationMatrix(mat, [1, 0]), [
  [4, 3],
  [2, 1],
]);

// Possession / dead time sanity checks (proporcje dodatnie i sensowne)
const teamPoss = getTeamPossessionPct(sampleMatch);
const oppPoss = getOpponentPossessionPct(sampleMatch);
const dead = getDeadTimePct(sampleMatch);
assert.ok(teamPoss > 0 && teamPoss < 100);
assert.ok(oppPoss > 0 && oppPoss < 100);
assert.ok(dead > 0 && dead < 100);

const teamMin = getTeamPossessionMinutes(sampleMatch);
const oppMin = getOpponentPossessionMinutes(sampleMatch);
const deadMin = getDeadTimeMinutes(sampleMatch);
assert.ok(teamMin > 0);
assert.ok(oppMin > 0);
assert.ok(deadMin > 0);

const shotsBreakdownMatch: TeamInfo = {
  team: "t1",
  opponent: "op",
  isHome: true,
  competition: "L",
  date: "2026-01-01",
  shots: [
    { id: "a1", x: 50, y: 50, minute: 1, xG: 0.1, isGoal: false, matchId: "m", timestamp: 1, shotType: "on_target", teamContext: "attack", teamId: "t1" },
    { id: "a2", x: 50, y: 50, minute: 2, xG: 0.1, isGoal: false, matchId: "m", timestamp: 2, shotType: "blocked", teamContext: "attack", teamId: "t1" },
    { id: "d1", x: 50, y: 50, minute: 3, xG: 0.1, isGoal: false, matchId: "m", timestamp: 3, shotType: "on_target", teamContext: "defense", teamId: "op" },
    { id: "d2", x: 50, y: 50, minute: 4, xG: 0.1, isGoal: false, matchId: "m", timestamp: 4, shotType: "blocked", teamContext: "defense", teamId: "op" },
  ],
} as TeamInfo;
assert.equal(getTeamShotsOnTargetCountForMatch(shotsBreakdownMatch), 1);
assert.equal(getTeamShotsBlockedCountForMatch(shotsBreakdownMatch), 1);
assert.equal(getOpponentShotsOnTargetCountForMatch(shotsBreakdownMatch), 1);
assert.equal(getOpponentShotsBlockedCountForMatch(shotsBreakdownMatch), 1);

// P2/P3: packing + regain (bez podwójnego liczenia tej samej listy)
const p2p3WithRegain: TeamInfo = {
  team: "t1",
  opponent: "op",
  isHome: true,
  competition: "L",
  date: "2026-01-01",
  actions_packing: [
    {
      id: "pk1",
      matchId: "m",
      teamId: "t1",
      minute: 1,
      actionType: "pass",
      senderId: "p1",
      isSecondHalf: false,
      isP2: true,
    } as any,
  ],
  actions_regain: [
    {
      id: "rg1",
      matchId: "m",
      teamId: "t1",
      minute: 2,
      actionType: "regain",
      senderId: "p1",
      isSecondHalf: false,
      isP3: true,
    } as any,
  ],
} as TeamInfo;
assert.equal(getTeamP2CountForMatch(p2p3WithRegain), 1);
assert.equal(getTeamP3CountForMatch(p2p3WithRegain), 1);
assert.equal(calculateTrendyKpiValue(p2p3WithRegain, "pxt_p2p3"), 2);

const packingXtMatch: TeamInfo = {
  team: "t1",
  opponent: "o",
  isHome: true,
  competition: "L",
  date: "2026-01-01",
  shots: [],
  matchData: {},
  actions_packing: [
    {
      id: "p1",
      matchId: "m",
      minute: 1,
      actionType: "pass",
      senderId: "a",
      isSecondHalf: false,
      packingPoints: 2,
      xTValueStart: 0.1,
      xTValueEnd: 0.2,
    } as any,
    {
      id: "p2",
      matchId: "m",
      minute: 2,
      actionType: "pass",
      senderId: "a",
      isSecondHalf: false,
      packingPoints: 3,
      xTValueStart: 0,
      xTValueEnd: 0.2,
    } as any,
  ],
} as TeamInfo;
assert.ok(Math.abs(getTeamXtDeltaSumForMatch(packingXtMatch) - 0.3) < 1e-9);
assert.equal(getTeamPackingPointsSumForMatch(packingXtMatch), 5);
assert.ok(Math.abs(getTeamPxtForMatch(packingXtMatch) - 0.8) < 1e-9);

console.log("trendyKpis tests: OK");
