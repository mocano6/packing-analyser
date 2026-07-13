import assert from "node:assert/strict";
import { parseStatsBombMatchStatsCsv, parseStatsBombPlayerScoutCsv } from "./statsbombCsvParser";
import { buildStatsBombScoutingComputation } from "./statsBombPlayerScouting";
import {
  buildMatchMetricPointsCorrelations,
  buildMatchMetricReferenceCorrelations,
  buildScoutingCriterionWeights,
  buildWeightedScoutingPoolRanking,
  computeScoutingWeightShare,
  describeScoutingWeightImpact,
  effectivePercentileForTeamCorrelation,
  listScoutingCorrelationReferenceMetrics,
  resolveScoutingMetricByPointsCorrelation,
  resolveScoutingMetricForWeighting,
  scoutingCorrelationEffectiveWeight,
  STATSBOMB_SCOUTING_CORR_MIN_ABS_R,
  STATSBOMB_SCOUTING_DEFAULT_REFERENCE_METRIC_ID,
} from "./statsBombScoutingCorrelationWeights";
import { STATSBOMB_DEFENSIVE_MIDFIELDER_SCOUTING } from "./statsBombScoutingProfiles";
import { collectSquadMetricColumns } from "./statsBombPlayerScouting";

const scoutCsv =
  "Player,Current Team,Minutes,Age,Passing%,Deep Progressions,Pressures,Clearances,OBV,Counterpressures in Opposing Half,Tackles & Interceptions,Dribbled Past,Turnovers,Dispossessed,Player SBD ID\n" +
  "Anchor FC,Club A,2000,26,88.0,6.5,18.0,5.0,0.12,8.0,4.2,1.1,1.5,0.8,1\n" +
  "Box2Box FC,Club B,1800,24,82.0,8.0,14.0,3.0,0.08,5.0,3.0,1.8,2.0,1.2,2\n" +
  "Destroyer FC,Club C,1500,28,79.0,4.0,22.0,7.0,0.15,10.0,5.5,0.8,2.5,1.0,3";

const matchCsv =
  "Match,Date,Cumulative xG,Goals & Penalty Goals,Shots,Goals Conceded,Opposition xG,Pressures,Clearances,OBV,Counterpressures in Opposing Half,Passing%,Deep Progressions,Turnovers,Dispossessed,Game Week,Game SBD ID\n" +
  "Team vs. A,2026-01-01,2.0,3,20,0,0.5,100,40,1.2,25,88,8,10,6,1,1\n" +
  "Team vs. B,2026-01-08,1.0,1,10,1,1.0,50,20,0.6,10,82,5,18,12,2,2\n" +
  "Team vs. C,2026-01-15,0.5,0,5,2,2.0,30,10,0.3,5,79,3,25,18,3,3\n" +
  "Team vs. D,2026-01-22,1.5,2,15,1,1.2,70,30,0.9,18,85,6,14,9,4,4";

const scoutPlayers = parseStatsBombPlayerScoutCsv(scoutCsv);
const matchRows = parseStatsBombMatchStatsCsv(matchCsv);
const computation = buildStatsBombScoutingComputation(scoutPlayers, "defensive_midfielder", {
  minMinutes: 300,
});

assert.ok(computation);

const correlations = buildMatchMetricPointsCorrelations(matchRows);
assert.ok(correlations.size > 0);

const referenceOptions = listScoutingCorrelationReferenceMetrics(matchRows);
assert.ok(referenceOptions.some((metric) => metric.id === "sb_points"));
assert.ok(referenceOptions.some((metric) => metric.id === "sb_win"));

const winCorrelations = buildMatchMetricReferenceCorrelations(matchRows, "sb_win");
assert.ok(winCorrelations.size > 0);

const clearancesCorr = [...correlations.values()].find((row) => row.label === "Clearances");
const obvCorr = [...correlations.values()].find((row) => row.label === "OBV");
const counterpressCorr = [...correlations.values()].find(
  (row) => row.label === "Counterpressures in Opposing Half",
);
assert.ok(clearancesCorr?.rPoints !== null);
assert.ok(obvCorr?.rPoints !== null);
assert.ok(counterpressCorr?.rPoints !== null);

const availableColumns = collectSquadMetricColumns(scoutPlayers);
const matchColumns = matchRows.flatMap((row) => Object.keys(row.numeric));

const clearancesCriterion = STATSBOMB_DEFENSIVE_MIDFIELDER_SCOUTING.criteria.find(
  (row) => row.id === "clearances",
)!;
const clearancesPick = resolveScoutingMetricByPointsCorrelation(
  clearancesCriterion,
  availableColumns,
  correlations,
  matchColumns,
);
assert.equal(clearancesPick.metricLabel, "Clearances");

const obvCriterion = STATSBOMB_DEFENSIVE_MIDFIELDER_SCOUTING.criteria.find(
  (row) => row.id === "on_ball_value",
)!;
assert.equal(obvCriterion.phase, "attack");
const obvPick = resolveScoutingMetricByPointsCorrelation(
  obvCriterion,
  availableColumns,
  correlations,
  matchColumns,
);
assert.equal(obvPick.metricLabel, "OBV");

const pressingCriterion = STATSBOMB_DEFENSIVE_MIDFIELDER_SCOUTING.criteria.find(
  (row) => row.id === "pressing_intensity",
)!;
const pressingPick = resolveScoutingMetricByPointsCorrelation(
  pressingCriterion,
  availableColumns,
  correlations,
  matchColumns,
);
assert.equal(pressingPick.metricLabel, "Counterpressures in Opposing Half");
assert.ok(
  Math.abs(pressingPick.matchCorrelation!.rPoints!) >=
    Math.abs(
      resolveScoutingMetricByPointsCorrelation(
        pressingCriterion,
        availableColumns,
        correlations,
        matchColumns,
      ).matchCorrelation!.rPoints!,
    ),
);

const weightsReport = buildScoutingCriterionWeights(computation!, matchRows);
assert.ok(weightsReport);
assert.equal(weightsReport!.matchCount, 4);
assert.equal(weightsReport!.referenceMetricId, STATSBOMB_SCOUTING_DEFAULT_REFERENCE_METRIC_ID);
assert.equal(weightsReport!.referenceMetricLabel, "Punkty");
assert.ok(weightsReport!.totalActiveWeight > 0);

const weightsByWin = buildScoutingCriterionWeights(computation!, matchRows, "sb_win");
assert.ok(weightsByWin);
assert.equal(weightsByWin!.referenceMetricId, "sb_win");
assert.equal(weightsByWin!.referenceMetricLabel, "Wygrana");

const weightedClearances = weightsReport!.criterionWeights.find((row) => row.criterionId === "clearances");
const weightedObv = weightsReport!.criterionWeights.find((row) => row.criterionId === "on_ball_value");
const weightedCounterpress = weightsReport!.criterionWeights.find(
  (row) => row.criterionId === "counterpress_opposing_half",
);
assert.equal(weightedClearances?.playerMetricLabel, "Clearances");
assert.equal(weightedClearances?.status, "weighted");
assert.equal(weightedObv?.playerMetricLabel, "OBV");
assert.equal(weightedObv?.status, "weighted");
assert.equal(weightedCounterpress?.playerMetricLabel, "Counterpressures in Opposing Half");
assert.equal(weightedCounterpress?.status, "weighted");
assert.ok(weightedObv!.weight >= STATSBOMB_SCOUTING_CORR_MIN_ABS_R);
assert.equal(weightedObv!.weight, weightedObv!.rPoints);

const ballRetentionCriterion = STATSBOMB_DEFENSIVE_MIDFIELDER_SCOUTING.criteria.find(
  (row) => row.id === "ball_retention",
)!;
const ballRetentionPick = resolveScoutingMetricForWeighting(
  ballRetentionCriterion,
  availableColumns,
  correlations,
  matchColumns,
);
assert.ok(ballRetentionPick.metricLabel === "Dispossessed" || ballRetentionPick.metricLabel === "Turnovers");
assert.ok((ballRetentionPick.matchCorrelation?.rPoints ?? 0) < 0);

const weightedBallRetention = weightsReport!.criterionWeights.find(
  (row) => row.criterionId === "ball_retention",
);
assert.ok(weightedBallRetention);
assert.ok(
  weightedBallRetention!.playerMetricLabel === "Dispossessed" ||
    weightedBallRetention!.playerMetricLabel === "Turnovers",
);
assert.equal(weightedBallRetention!.matchMetricLabel, weightedBallRetention!.playerMetricLabel);
assert.equal(weightedBallRetention!.status, "weighted");
assert.ok((weightedBallRetention!.rPoints ?? 0) < 0);
assert.ok(weightedBallRetention!.weight >= STATSBOMB_SCOUTING_CORR_MIN_ABS_R);
assert.equal(
  weightedBallRetention!.weight,
  scoutingCorrelationEffectiveWeight(weightedBallRetention!.rPoints!, false),
);
assert.equal(weightedBallRetention!.higherIsBetter, false);
assert.ok(
  describeScoutingWeightImpact(weightedBallRetention!, "Punkty", 4).includes("mniej = lepiej"),
);

assert.equal(scoutingCorrelationEffectiveWeight(-0.4, false), 0.4);
assert.equal(scoutingCorrelationEffectiveWeight(0.4, true), 0.4);
assert.equal(effectivePercentileForTeamCorrelation(80, -0.4, false), 80);

const negativeOnlyMatchCsv =
  "Match,Date,Cumulative xG,Goals & Penalty Goals,Shots,Goals Conceded,Opposition xG,Pressures,Clearances,Game Week,Game SBD ID\n" +
  "Team vs. A,2026-01-01,2.0,3,20,0,0.5,100,40,1,1\n" +
  "Team vs. B,2026-01-08,1.0,1,10,1,1.0,50,20,2,2\n" +
  "Team vs. C,2026-01-15,0.5,0,5,2,2.0,30,10,3,3\n" +
  "Team vs. D,2026-01-22,1.5,2,15,1,1.2,70,30,4,4";
const negativeMatchRows = parseStatsBombMatchStatsCsv(negativeOnlyMatchCsv);
const negativeWeights = buildScoutingCriterionWeights(computation!, negativeMatchRows, "sb_gd");
assert.ok(negativeWeights);
const negativeClearances = negativeWeights!.criterionWeights.find((row) => row.criterionId === "clearances");
if (negativeClearances && (negativeClearances.rPoints ?? 0) < 0) {
  assert.equal(negativeClearances.status, "negative_correlation");
  assert.equal(negativeClearances.weight, 0);
  assert.ok(describeScoutingWeightImpact(negativeClearances, "GD", 4).includes("nie są doliczane"));
}

const weightingPick = resolveScoutingMetricForWeighting(
  clearancesCriterion,
  availableColumns,
  correlations,
  matchColumns,
);
assert.equal(weightingPick.metricLabel, "Clearances");

assert.equal(computeScoutingWeightShare(0.35, 1), 35);
assert.equal(computeScoutingWeightShare(0, 1), null);

assert.equal(effectivePercentileForTeamCorrelation(80, 0.5, true), 80);
assert.equal(effectivePercentileForTeamCorrelation(80, -0.5, true), 20);

const weightedRanking = buildWeightedScoutingPoolRanking(computation!, weightsReport!);
assert.equal(weightedRanking.length, 3);
assert.ok(
  (weightedRanking[0]!.weightedFitPercentile ?? 0) >=
    (weightedRanking[1]!.weightedFitPercentile ?? 0),
);

console.log("statsBombScoutingCorrelationWeights tests: OK");
