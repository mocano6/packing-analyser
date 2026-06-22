import assert from "assert";
import { parseStatsBombMatchStatsCsv } from "./statsbombCsvParser";
import {
  filterStatsBombMatchesByOutcome,
  getStatsBombMatchOutcome,
} from "./statsBombMatchOutcome";
import { buildStatsBombTeamMedianDistribution } from "./statsBombTeamMedianDistribution";
import {
  buildStatsBombTeamOutcomeMedianReport,
  sortOutcomeMetricSummaries,
  toggleOutcomeSummarySort,
} from "./statsBombTeamOutcomeMedianAnalysis";

const MATCH_CSV =
  "Match,Date,Cumulative xG,Goals & Penalty Goals,Shots,Passes,Pressures,Goals Conceded,Opposition xG,Game Week,Game SBD ID\n" +
  "Team A vs. Jagiellonia,2024-08-01,1.2,2,12,400,80,0,0.8,1,1\n" +
  "Team B vs. Jagiellonia,2024-08-08,0.8,1,8,350,60,1,1.5,2,2\n" +
  "Team C vs. Jagiellonia,2024-08-15,2.1,3,18,520,110,1,0.5,3,3\n" +
  "Team D vs. Jagiellonia,2024-08-22,0.5,0,5,280,45,2,2.0,4,4\n";

const rows = parseStatsBombMatchStatsCsv(MATCH_CSV);

assert.equal(getStatsBombMatchOutcome(rows[0]!), "win");
assert.equal(getStatsBombMatchOutcome(rows[1]!), "draw");
assert.equal(getStatsBombMatchOutcome(rows[3]!), "loss");
assert.equal(filterStatsBombMatchesByOutcome(rows, "win").length, 2);
assert.equal(filterStatsBombMatchesByOutcome(rows, "draw").length, 1);
assert.equal(filterStatsBombMatchesByOutcome(rows, "loss").length, 1);

const medianReport = buildStatsBombTeamMedianDistribution(rows);
assert.ok(medianReport);

const outcomeReport = buildStatsBombTeamOutcomeMedianReport(rows, medianReport!);
assert.ok(outcomeReport);
assert.equal(outcomeReport!.summary.winCount, 2);
assert.equal(outcomeReport!.summary.drawCount, 1);
assert.equal(outcomeReport!.summary.lossCount, 1);
assert.ok(outcomeReport!.rankedByOutcome.win.length > 0);

const passesMetric = outcomeReport!.metrics.find((m) => m.label === "Passes");
assert.ok(passesMetric);
assert.equal(passesMetric!.win.matchCount, 2);
assert.ok(passesMetric!.win.avgDeviation !== null);

{
  const sorted = sortOutcomeMetricSummaries(outcomeReport!.metrics, "all", "label", "asc");
  assert.ok(sorted[0]!.label.localeCompare(sorted[1]!.label, "pl") <= 0);
}

{
  const toggled = toggleOutcomeSummarySort("avgAbsDeviation", "desc", "avgAbsDeviation");
  assert.equal(toggled.direction, "asc");
  const switched = toggleOutcomeSummarySort("avgAbsDeviation", "desc", "label");
  assert.equal(switched.sortKey, "label");
  assert.equal(switched.direction, "asc");
}

console.log("statsBombTeamOutcomeMedianAnalysis.test.ts OK");
