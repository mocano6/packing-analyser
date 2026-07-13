import assert from "node:assert/strict";
import type { PlayerComparisonRow } from "./playerComparisonMetrics";
import {
  buildPlayerWeightedIndexRanking,
  canComputeWeightedIndex,
  computePlayerWeightedIndex,
  getActiveWeightedMetricConfigs,
  getActiveWeightedMetricWeightSum,
  getDefaultWeightedIndexBetterWhen,
  getRemainingWeightedIndexPoints,
  getWeightedIndexMetricLabel,
  normalizeWeightedIndexMetricScore,
  normalizeWeightedMetricConfigs,
  sanitizeWeightedIndexConfigs,
  setWeightedIndexMetricWeight,
  toggleWeightedIndexMetric,
  WEIGHTED_INDEX_POINT_BUDGET,
} from "./playerComparisonWeightedIndex";
import { buildDefaultWeightedIndexConfigs } from "./playerComparisonWeightedIndexPreferences";

const makeRow = (id: string, values: Partial<Record<string, number>>): PlayerComparisonRow => ({
  playerId: id,
  playerName: id,
  lastName: id,
  firstName: id,
  position: "CM",
  number: 1,
  teamIds: ["t1"],
  minutes: 900,
  matchesPlayed: 10,
  hasMinutes: true,
  raw: {} as PlayerComparisonRow["raw"],
  eventStats: {},
  values: {
    packing: 0,
    packingSender: 0,
    packingReceiver: 0,
    packingDribble: 0,
    pxt: 0,
    pxtSender: 0,
    pxtReceiver: 0,
    pxtDribble: 0,
    xt: 0,
    xtSender: 0,
    xtReceiver: 0,
    xtDribble: 0,
    xg: 0,
    shots: 0,
    goals: 0,
    xgPerShot: 0,
    shotsPerGoal: 0,
    xgPerGoal: 0,
    pkEntries: 0,
    pkEntriesSender: 0,
    pkEntriesReceiver: 0,
    pkEntriesDribble: 0,
    xgOnPitchAttack: 0,
    xgOnPitchDefense: 0,
    pkEntriesOnPitchAttack: 0,
    pkEntriesOnPitchDefense: 0,
    regains: 0,
    regainsOwnHalf: 0,
    regainsOpponentHalf: 0,
    regainsXt: 0,
    regainsXtAttack: 0,
    regainsXtDefense: 0,
    loses: 0,
    losesOwnHalf: 0,
    losesOpponentHalf: 0,
    losesXt: 0,
    losesXtAttack: 0,
    losesXtDefense: 0,
    phaseP1Sender: 0,
    phaseP1Receiver: 0,
    phaseP2Sender: 0,
    phaseP2Receiver: 0,
    phaseP3Sender: 0,
    phaseP3Receiver: 0,
    defenseShotLine: 0,
    defenseShotBlockXg: 0,
    ...values,
  },
});

const rows = [
  makeRow("a", { pxtSender: 2, pxtReceiver: 1, xtSender: 1, xg: 0.5, regains: 4 }),
  makeRow("b", { pxtSender: 1, pxtReceiver: 2, xtSender: 2, xg: 0.25, regains: 2 }),
  makeRow("c", { pxtSender: 0.5, pxtReceiver: 0.5, xtSender: 0.5, xg: 0.1, regains: 1 }),
];

const configs = sanitizeWeightedIndexConfigs([
  { metricId: "pxtSender", enabled: true, weight: 20, betterWhen: "higher" },
  { metricId: "pxtReceiver", enabled: true, weight: 10, betterWhen: "higher" },
  { metricId: "xtSender", enabled: true, weight: 20, betterWhen: "higher" },
]);

assert.equal(getWeightedIndexMetricLabel("pxtSender"), "PXT/podanie");
assert.equal(getWeightedIndexMetricLabel("defenseShotLine"), "Na linii strzału (obrona)");
assert.equal(getWeightedIndexMetricLabel("defenseShotBlockXg"), "xG zablokowanych strzałów (obrona)");
assert.equal(getDefaultWeightedIndexBetterWhen("loses"), "lower");
assert.equal(getDefaultWeightedIndexBetterWhen("goals"), "higher");
assert.equal(getActiveWeightedMetricWeightSum(configs), 50);
assert.equal(getRemainingWeightedIndexPoints(configs), 50);
assert.equal(canComputeWeightedIndex(configs), true);

const toggled = toggleWeightedIndexMetric(
  [
    ...configs,
    { metricId: "pkEntriesDribble", enabled: false, weight: 0, betterWhen: "higher" },
  ],
  "pkEntriesDribble",
  true,
);
assert.equal(toggled.find((c) => c.metricId === "pxtSender")?.weight, 20);
assert.equal(toggled.find((c) => c.metricId === "pkEntriesDribble")?.enabled, true);

const reweighted = setWeightedIndexMetricWeight(toggled, "pxtSender", 70);
assert.equal(reweighted.find((c) => c.metricId === "pxtSender")?.weight, 70);
assert.equal(reweighted.find((c) => c.metricId === "pxtReceiver")?.weight, 10);

assert.deepEqual(
  normalizeWeightedMetricConfigs([
    { metricId: "pxtSender", enabled: true, weight: 30, betterWhen: "higher" },
    { metricId: "xtSender", enabled: true, weight: 20, betterWhen: "higher" },
  ])
    .filter((c) => c.enabled)
    .map((c) => c.weight),
  [60, 40],
);

const leader = computePlayerWeightedIndex(rows, rows[0], configs);
const follower = computePlayerWeightedIndex(rows, rows[2], configs);

assert.ok(leader.index > follower.index, "leader should have higher weighted index");
assert.equal(leader.contributions.length, 3);
assert.ok(Math.abs(leader.index - leader.contributions.reduce((s, c) => s + c.contribution, 0)) < 0.001);

const ranking = buildPlayerWeightedIndexRanking(rows, sanitizeWeightedIndexConfigs([
  { metricId: "pxtSender", enabled: true, weight: 100, betterWhen: "higher" },
]));
assert.equal(ranking[0]?.row.playerId, "a");
assert.equal(ranking.at(-1)?.row.playerId, "c");

const empty = computePlayerWeightedIndex(rows, rows[0], []);
assert.equal(empty.index, 0);
assert.equal(empty.contributions.length, 0);

const defaults = buildDefaultWeightedIndexConfigs();
assert.ok(getActiveWeightedMetricConfigs(defaults).length >= 4);
assert.equal(defaults.find((c) => c.metricId === "loses")?.betterWhen, "lower");

const lossRows = [makeRow("few", { loses: 1 }), makeRow("many", { loses: 5 })];
assert.ok(
  normalizeWeightedIndexMetricScore(lossRows, lossRows[0], "loses", "lower") >
    normalizeWeightedIndexMetricScore(lossRows, lossRows[1], "loses", "lower"),
  "fewer loses should normalize higher when lower is better",
);

const lossConfigs = sanitizeWeightedIndexConfigs([
  { metricId: "loses", enabled: true, weight: 100, betterWhen: "lower" },
]);
const fewLossIndex = computePlayerWeightedIndex(lossRows, lossRows[0], lossConfigs);
const manyLossIndex = computePlayerWeightedIndex(lossRows, lossRows[1], lossConfigs);
assert.ok(fewLossIndex.index > manyLossIndex.index, "player with fewer loses should rank higher");

console.log("playerComparisonWeightedIndex.test.ts: ok");
