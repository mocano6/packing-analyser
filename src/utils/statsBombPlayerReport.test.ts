import assert from "node:assert/strict";
import { readFileSync, existsSync } from "fs";
import {
  detectStatsBombCsvKind,
  detectStatsBombSquadGoalkeeper,
  parseStatsBombSquadStatsCsv,
} from "./statsbombCsvParser";
import {
  buildStatsBombPlayerReport,
  computePlayerMetricPercentile,
  estimateSeasonTotalFromPer90,
  isGoalkeeperOnlyMetric,
  isLowerBetterPlayerMetric,
  supportsSeasonTotalEstimate,
  STATSBOMB_PLAYER_STRONG_PERCENTILE,
} from "./statsBombPlayerReport";

const sampleSquadCsv =
  "Player,Minutes,Age,Shots,Turnovers,Pressures,Shots Faced,Saves,Goals Saved Above Average,Player SBD ID\n" +
  "Alice,2000,25,3.0,1.0,12.0,0,0,0,1\n" +
  "Bob,1800,27,1.0,2.5,8.0,0,0,0,2\n" +
  "Carol,1500,23,0.5,3.0,6.0,0,0,0,3\n" +
  "Dave,250,30,0.2,4.0,4.0,0,0,0,4\n" +
  "Keeper,1200,28,0,0.5,0.2,12.0,8.0,0.1,5\n";

assert.equal(detectStatsBombCsvKind(sampleSquadCsv), "squad");

const players = parseStatsBombSquadStatsCsv(sampleSquadCsv);
assert.equal(players.length, 5);
assert.equal(players[0]?.name, "Alice");
assert.equal(players.find((p) => p.name === "Keeper")?.isGoalkeeper, true);
assert.equal(players.find((p) => p.name === "Alice")?.isGoalkeeper, false);

assert.equal(isGoalkeeperOnlyMetric("Shots Faced"), true);
assert.equal(isGoalkeeperOnlyMetric("Shots"), false);
assert.equal(isLowerBetterPlayerMetric("Turnovers"), true);
assert.equal(isLowerBetterPlayerMetric("Shots"), false);

const percentile = computePlayerMetricPercentile(3.0, [1.0, 0.5, 0.2, 3.0], true);
assert.ok(percentile !== null && percentile >= 75);

const report = buildStatsBombPlayerReport(players, 300);
assert.ok(report);
assert.equal(report!.summary.playerCount, 5);
assert.equal(report!.summary.eligiblePlayerCount, 4);

const alice = report!.profiles[players[0]!.playerId];
assert.ok(alice);
assert.ok(alice!.strengths.some((row) => row.label === "Shots"));
assert.ok(alice!.strengths.every((row) => (row.percentile ?? 0) >= STATSBOMB_PLAYER_STRONG_PERCENTILE));
assert.ok(alice!.allParameters.some((row) => row.label === "Shots"));
assert.equal(alice!.allParameters.find((row) => row.label === "Shots")?.seasonTotal, 3.0 * (2000 / 90));
assert.equal(alice!.allParameters.find((row) => row.label === "Shots")?.isSquadLeader, true);
assert.ok(report!.squadStandouts.some((row) => row.label === "Shots" && row.leader.displayName === "Alice"));

assert.equal(supportsSeasonTotalEstimate("Passing%"), false);
assert.equal(estimateSeasonTotalFromPer90(2, 900), 20);

const keeper = report!.profiles[players.find((p) => p.name === "Keeper")!.playerId];
assert.ok(keeper);
assert.ok(keeper!.ranked.some((row) => row.label === "Shots Faced" || row.label === "Saves"));

const realPath =
  "/Users/lukaszferszt/Downloads/jaga/fwdiietaprekrutacjizadaniepraktycznejagielloniab/JagielloniaBiałystok-Squad STATS.csv";
if (existsSync(realPath)) {
  const realPlayers = parseStatsBombSquadStatsCsv(readFileSync(realPath, "utf8"));
  assert.ok(realPlayers.length >= 20);
  const realReport = buildStatsBombPlayerReport(realPlayers, 300);
  assert.ok(realReport);
  const topPlayer = realPlayers[0]!;
  const profile = realReport!.profiles[topPlayer.playerId];
  assert.ok(profile);
  assert.ok(profile!.ranked.length > 50);
  assert.ok(profile!.allParameters.length > 50);
  assert.ok(realReport!.squadStandouts.length > 50);
  assert.ok(profile!.strengths.length > 0 || profile!.weaknesses.length > 0);
}

assert.equal(
  detectStatsBombSquadGoalkeeper({ "Shots Faced": 10, Saves: 5 }),
  true,
);

console.log("statsBombPlayerReport tests: OK");
