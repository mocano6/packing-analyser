import assert from "node:assert/strict";
import { readFileSync, existsSync } from "fs";
import { parseStatsBombMatchStatsCsv } from "./statsbombCsvParser";
import { buildStatsBombTeamMedianDistribution } from "./statsBombTeamMedianDistribution";
import { buildStatsBombTeamOutcomeMedianReport } from "./statsBombTeamOutcomeMedianAnalysis";
import {
  computeStatsBombDeviationPct,
  isStatsBombDeviationPctReliable,
  statsBombDeviationPctBaseline,
} from "./statsBombMedianDeviation";

const sparseStats = {
  min: 0,
  q1: 0,
  median: 0.0274606645,
  q3: 0.049359218225,
  mean: 0.07312580582941176,
  count: 34,
};

assert.ok(Math.abs(statsBombDeviationPctBaseline(sparseStats)! - 0.049359218225) < 1e-9);
assert.ok(Math.abs(computeStatsBombDeviationPct(0, sparseStats.median, sparseStats)! + 55.6) < 1);
assert.ok(
  Math.abs(computeStatsBombDeviationPct(0.1124, sparseStats.median, sparseStats)! - 173) < 2,
);

const zeroMedianStats = {
  min: 0,
  q1: 0,
  median: 0,
  q3: 0,
  mean: 0.0055,
  count: 34,
};
assert.equal(isStatsBombDeviationPctReliable(zeroMedianStats, [0, 0, 0.01, 0.05]), false);

const passesStats = {
  min: 280,
  q1: 350,
  median: 387.5,
  q3: 460,
  mean: 400,
  count: 4,
};
assert.equal(isStatsBombDeviationPctReliable(passesStats, [400, 350, 520, 280]), true);
assert.ok(Math.abs(computeStatsBombDeviationPct(400, passesStats.median, passesStats)! - 3.2) < 0.5);

const realPath =
  "/Users/lukaszferszt/Downloads/jaga/fwdiietaprekrutacjizadaniepraktycznejagielloniab/JagielloniaBiałystok-MatchStats (1).csv";
if (existsSync(realPath)) {
  const rows = parseStatsBombMatchStatsCsv(readFileSync(realPath, "utf8"));
  const medianReport = buildStatsBombTeamMedianDistribution(rows)!;
  const outcomeReport = buildStatsBombTeamOutcomeMedianReport(rows, medianReport)!;
  const throwInXg = outcomeReport.metrics.find((m) => m.label === "Opposition Throw-in xG");
  assert.ok(throwInXg);
  assert.equal(throwInXg!.win.pctReliable, false);
  assert.equal(throwInXg!.win.avgDeviationPct, null);
  assert.ok((throwInXg!.win.avgAbsDeviation ?? 0) > 0);

  const throwInXgOwn = outcomeReport.metrics.find((m) => m.label === "Throw-in xG");
  assert.ok(throwInXgOwn);
  assert.equal(throwInXgOwn!.win.pctReliable, false);
}

console.log("statsBombMedianDeviation.test.ts OK");
