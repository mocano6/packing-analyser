import assert from "node:assert/strict";
import { readFileSync, existsSync } from "fs";
import { parseStatsBombSquadStatsCsv } from "./statsbombCsvParser";
import { buildStatsBombPlayerReport } from "./statsBombPlayerReport";
import {
  buildStatsBombPlayerScoutingReportFromComputation,
  buildStatsBombScoutingComputation,
  buildStatsBombScoutingPoolRanking,
  collectSquadMetricColumns,
  resolveScoutingMetricColumn,
} from "./statsBombPlayerScouting";
import { STATSBOMB_DEFENSIVE_MIDFIELDER_SCOUTING } from "./statsBombScoutingProfiles";
import {
  detectStatsBombCsvKind,
  parseStatsBombPlayerScoutCsv,
} from "./statsbombCsvParser";

const sampleSquadCsv =
  "Player,Minutes,Age,Passing%,Deep Progressions,Pressures,Tackles & Interceptions,Dribbled Past,Turnovers,Player SBD ID\n" +
  "Anchor,2000,26,88.0,6.5,18.0,4.2,1.1,1.5,1\n" +
  "Box2Box,1800,24,82.0,8.0,14.0,3.0,1.8,2.0,2\n" +
  "Destroyer,1500,28,79.0,4.0,22.0,5.5,0.8,2.5,3\n" +
  "Bench,200,22,70.0,1.0,5.0,1.0,0.5,3.0,4";

const scoutCsv =
  "Player,Current Team,Minutes,Age,Passing%,Deep Progressions,Pressures,Tackles & Interceptions,Dribbled Past,Turnovers,Dispossessed,Player SBD ID\n" +
  "Anchor FC,Club A,2000,26,88.0,6.5,18.0,4.2,1.1,1.5,0.8,1\n" +
  "Box2Box FC,Club B,1800,24,82.0,8.0,14.0,3.0,1.8,2.0,1.2,2\n" +
  "Destroyer FC,Club C,1500,28,79.0,4.0,22.0,5.5,0.8,2.5,1.0,3";

assert.equal(detectStatsBombCsvKind(scoutCsv), "scout");
assert.equal(detectStatsBombCsvKind(sampleSquadCsv), "squad");

const scoutPlayers = parseStatsBombPlayerScoutCsv(scoutCsv);
assert.equal(scoutPlayers.length, 3);
assert.equal(scoutPlayers[0]!.currentTeam, "Club A");
assert.equal(scoutPlayers[0]!.displayName, "Anchor FC");

const players = parseStatsBombSquadStatsCsv(sampleSquadCsv);
const columns = collectSquadMetricColumns(players);

assert.equal(
  resolveScoutingMetricColumn(["Passing%", "Successful Passes"], columns),
  "Passing%",
);
assert.equal(
  resolveScoutingMetricColumn(["Non Throw-in Passes Into Final Third"], columns),
  null,
);

const computation = buildStatsBombScoutingComputation(scoutPlayers, "defensive_midfielder", {
  minMinutes: 300,
});
assert.ok(computation);

const anchorId = scoutPlayers[0]!.playerId;
const scouting = buildStatsBombPlayerScoutingReportFromComputation(computation!, anchorId);
assert.ok(scouting);
assert.equal(scouting!.position.id, "defensive_midfielder");
assert.equal(scouting!.criteria.length, STATSBOMB_DEFENSIVE_MIDFIELDER_SCOUTING.criteria.length);

const passQuality = scouting!.criteria.find((row) => row.criterionId === "pass_quality");
assert.ok(passQuality);
assert.equal(passQuality!.metricLabel, "Passing%");
assert.equal(passQuality!.status, "matched");

const pressing = scouting!.criteria.find((row) => row.criterionId === "pressing_intensity");
assert.ok(pressing);
assert.equal(pressing!.metricLabel, "Pressures");

const ballRetention = scouting!.criteria.find((row) => row.criterionId === "ball_retention");
assert.ok(ballRetention);
assert.equal(ballRetention!.metricLabel, "Dispossessed");
assert.equal(ballRetention!.status, "matched");
assert.equal(ballRetention!.higherIsBetter, false);

assert.ok(scouting!.attackSummary.totalCount >= 9);
assert.ok(scouting!.defenseSummary.totalCount >= 7);

const pool = buildStatsBombScoutingPoolRanking(scoutPlayers, "defensive_midfielder", {
  minMinutes: 300,
});
assert.equal(pool.length, 3);
assert.ok((pool[0]!.overallFitPercentile ?? 0) >= (pool[1]!.overallFitPercentile ?? 0));

const ageFiltered = buildStatsBombScoutingPoolRanking(scoutPlayers, "defensive_midfielder", {
  minMinutes: 300,
  minAge: 27,
});
assert.equal(ageFiltered.length, 1);
assert.equal(ageFiltered[0]!.displayName, "Destroyer FC");

const realScoutPath =
  "/Users/lukaszferszt/Downloads/jaga/fwdiietaprekrutacjizadaniepraktycznejagielloniab/PlayerScout number 6 .csv";
if (existsSync(realScoutPath)) {
  const started = Date.now();
  const realScoutPlayers = parseStatsBombPlayerScoutCsv(readFileSync(realScoutPath, "utf8"));
  assert.ok(realScoutPlayers.length >= 20);
  assert.ok(realScoutPlayers.every((p) => typeof p.currentTeam === "string"));
  const realPool = buildStatsBombScoutingPoolRanking(realScoutPlayers, "defensive_midfielder", {
    minMinutes: 300,
  });
  assert.ok(realPool.length >= 10);
  assert.ok(realPool[0]!.overallFitPercentile !== null);
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 15000, `scouting pool too slow: ${elapsed}ms`);
}

console.log("statsBombPlayerScouting.test.ts OK");
