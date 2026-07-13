import assert from "node:assert/strict";
import { parseStatsBombPlayerScoutCsv } from "./statsbombCsvParser";
import { buildStatsBombScoutingComputation, collectSquadMetricColumns } from "./statsBombPlayerScouting";
import { STATSBOMB_DEFENSIVE_MIDFIELDER_SCOUTING } from "./statsBombScoutingProfiles";
import {
  buildEmptyManualConfig,
  buildManualWeightedScoutingPoolRanking,
  buildManualWeightedScoutingReport,
  computeManualConfigTotalShare,
  computeManualWeightedFitFromMetrics,
  createManualMetricEntryId,
  listAllScoutingMetricOptions,
  listMetricOptionsForScoutingCriterion,
  manualConfigHasActiveWeights,
  playerMetricMatchesCriterionPhase,
  sanitizeManualConfig,
} from "./statsBombScoutingManualConfig";

const scoutCsv =
  "Player,Current Team,Minutes,Age,Passing%,Deep Progressions,Pressures,Clearances,OBV,Counterpressures in Opposing Half,Tackles & Interceptions,Dribbled Past,Turnovers,Player SBD ID\n" +
  "Anchor FC,Club A,2000,26,88.0,6.5,18.0,5.0,0.12,8.0,4.2,1.1,1.5,1\n" +
  "Box2Box FC,Club B,1800,24,82.0,8.0,14.0,3.0,0.08,5.0,3.0,1.8,2.0,2\n" +
  "Destroyer FC,Club C,1500,28,79.0,4.0,22.0,7.0,0.15,10.0,5.5,0.8,2.5,3";

const players = parseStatsBombPlayerScoutCsv(scoutCsv);
const computation = buildStatsBombScoutingComputation(players, "defensive_midfielder", {
  minMinutes: 300,
});
assert.ok(computation);

const pressingCriterion = STATSBOMB_DEFENSIVE_MIDFIELDER_SCOUTING.criteria.find(
  (row) => row.id === "pressing_intensity",
)!;
const passCriterion = STATSBOMB_DEFENSIVE_MIDFIELDER_SCOUTING.criteria.find(
  (row) => row.id === "pass_quality",
)!;

const availableColumns = collectSquadMetricColumns(players);

const pressingOptions = listMetricOptionsForScoutingCriterion(pressingCriterion, availableColumns);
assert.ok(pressingOptions.suggested.includes("Pressures"));
assert.ok(
  pressingOptions.suggested.includes("Counterpressures in Opposing Half") ||
    pressingOptions.other.includes("Counterpressures in Opposing Half"),
);

const passOptions = listMetricOptionsForScoutingCriterion(passCriterion, availableColumns);
assert.ok(passOptions.suggested.includes("Passing%"));

assert.equal(playerMetricMatchesCriterionPhase("Passing%", passCriterion), true);
assert.equal(playerMetricMatchesCriterionPhase("Pressures", pressingCriterion), true);

const allOptions = listAllScoutingMetricOptions(availableColumns);
assert.ok(allOptions.includes("Passing%"));
assert.ok(allOptions.includes("Pressures"));

assert.deepEqual(buildEmptyManualConfig(), []);
assert.equal(sanitizeManualConfig(computation!, null).length, 0);

const manualConfig = sanitizeManualConfig(computation!, [
  {
    id: createManualMetricEntryId(),
    metricLabel: "Deep Progressions",
    sharePercent: 60,
  },
  {
    id: createManualMetricEntryId(),
    metricLabel: "Pressures",
    sharePercent: 40,
  },
  {
    id: createManualMetricEntryId(),
    metricLabel: "Deep Progressions",
    sharePercent: 10,
  },
]);

assert.equal(manualConfig.length, 2);
assert.equal(computeManualConfigTotalShare(manualConfig), 100);

const anchorReport = buildManualWeightedScoutingReport(
  computation!,
  players[0]!.playerId,
  manualConfig,
);
assert.ok(anchorReport);
assert.ok(anchorReport!.overallFitPercentile !== null);
assert.equal(anchorReport!.metrics.length, 2);

const fit = computeManualWeightedFitFromMetrics(anchorReport!.metrics);
assert.equal(fit, anchorReport!.overallFitPercentile);

const manualRanking = buildManualWeightedScoutingPoolRanking(computation!, manualConfig);
assert.equal(manualRanking.length, 3);
assert.ok(manualConfigHasActiveWeights(manualConfig));
assert.equal(manualConfigHasActiveWeights(buildEmptyManualConfig()), false);

console.log("statsBombScoutingManualConfig tests: OK");
