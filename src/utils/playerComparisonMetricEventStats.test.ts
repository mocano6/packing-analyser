import assert from "node:assert/strict";
import {
  bumpPlayerComparisonEventCountOnly,
  bumpPlayerComparisonEventStat,
  createEmptyPlayerComparisonEventStats,
  formatWeightedIndexChartEventLabel,
  formatWeightedIndexEventBreakdown,
  getWeightedIndexEventDisplayMode,
  resolvePlayerComparisonMetricEventStats,
} from "./playerComparisonMetricEventStats";
import type { PlayerComparisonRow } from "./playerComparisonMetrics";

const stats = createEmptyPlayerComparisonEventStats();
bumpPlayerComparisonEventStat(stats, "regains", true);
bumpPlayerComparisonEventStat(stats, "regains", false);
assert.equal(getWeightedIndexEventDisplayMode("regains"), "ratio");
assert.equal(formatWeightedIndexChartEventLabel("regains", stats.regains), "1/2");
assert.equal(formatWeightedIndexEventBreakdown("regains", stats.regains), "1/2 zdarz.");

const losesStats = createEmptyPlayerComparisonEventStats();
bumpPlayerComparisonEventCountOnly(losesStats, "loses", 80);
assert.equal(getWeightedIndexEventDisplayMode("loses"), "countOnly");
assert.equal(formatWeightedIndexChartEventLabel("loses", losesStats.loses), "80");
assert.equal(formatWeightedIndexEventBreakdown("loses", losesStats.loses), "80 zdarzeń");

const row = {
  playerId: "p1",
  raw: { phaseP1Sender: 7 } as PlayerComparisonRow["raw"],
  eventStats: {},
} as PlayerComparisonRow;
assert.equal(resolvePlayerComparisonMetricEventStats(row, "phaseP1Sender")?.total, 7);

console.log("playerComparisonMetricEventStats.test: ok");
