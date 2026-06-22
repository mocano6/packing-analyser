import assert from "assert";
import { parseStatsBombMatchStatsCsv, parseStatsBombSquadStatsCsv } from "./statsbombCsvParser";
import {
  classifyPlayerMedianCategory,
  classifyTeamMedianCategory,
  computeDistributionStats,
  percentile,
  valueToChartPercent,
} from "./statsBombMedianDistribution";
import { buildStatsBombPlayerMedianDistribution } from "./statsBombPlayerMedianDistribution";
import { buildStatsBombTeamMedianDistribution } from "./statsBombTeamMedianDistribution";

const MATCH_CSV =
  "Match,Date,Cumulative xG,Goals & Penalty Goals,Shots,Passes,Pressures,Goals Conceded,Opposition xG,Game Week,Game SBD ID\n" +
  "Team A vs. Jagiellonia,2024-08-01,1.2,2,12,400,80,0,0.8,1,1\n" +
  "Team B vs. Jagiellonia,2024-08-08,0.8,1,8,350,60,1,1.5,2,2\n" +
  "Team C vs. Jagiellonia,2024-08-15,2.1,3,18,520,110,1,0.5,3,3\n" +
  "Team D vs. Jagiellonia,2024-08-22,0.5,0,5,280,45,2,2.0,4,4\n";

const SQUAD_CSV =
  "Player,Minutes,Age,Preferred Foot,Passes,Shots,Pressures,Tackles,Player SBD ID\n" +
  "Alice,1200,24,Right,55,2,8,3,p1\n" +
  "Bob,900,26,Left,48,1,6,2,p2\n" +
  "Carol,1500,22,Right,62,4,12,5,p3\n" +
  "Dave,400,28,Right,30,0,2,1,p4\n";

// percentile + distribution stats
{
  const stats = computeDistributionStats([1, 2, 3, 4, 100]);
  assert.ok(stats);
  assert.equal(stats!.median, 3);
  assert.equal(stats!.q1, 2);
  assert.equal(stats!.q3, 4);
  assert.equal(stats!.min, 1);
  assert.equal(stats!.max, 100);
}

assert.equal(percentile([1, 2, 3, 4], 50), 2.5);

// kategoryzacja jak w PDF
assert.equal(classifyTeamMedianCategory("Passes"), "attack_building");
assert.equal(classifyTeamMedianCategory("Shots"), "chance_creation");
assert.equal(classifyTeamMedianCategory("Pressures"), "pressing");
assert.equal(classifyTeamMedianCategory("Opposition xG"), "goal_defense");

assert.equal(classifyPlayerMedianCategory("Tackles"), "defensive_profile");
assert.equal(classifyPlayerMedianCategory("Passes"), "offensive_profile");
assert.equal(classifyPlayerMedianCategory("Deep progressions"), "third_third");

// wykres — wartość w zakresie 0–100
{
  const stats = computeDistributionStats([10, 20, 30, 40, 50])!;
  const pct = valueToChartPercent(30, stats);
  assert.ok(pct >= 0 && pct <= 100);
}

// raport zespołowy
{
  const rows = parseStatsBombMatchStatsCsv(MATCH_CSV);
  const report = buildStatsBombTeamMedianDistribution(rows);
  assert.ok(report);
  assert.ok(report!.allMetrics.length > 0);
  assert.ok(report!.categorySections.length > 0);

  const passes = report!.allMetrics.find((m) => m.label === "Passes");
  assert.ok(passes);
  assert.equal(passes!.observations.length, 4);
  assert.ok(passes!.stats.median > 0);
}

// raport zawodników
{
  const players = parseStatsBombSquadStatsCsv(SQUAD_CSV);
  const report = buildStatsBombPlayerMedianDistribution(players, 500);
  assert.ok(report);
  assert.ok(report!.allMetrics.some((m) => m.label === "Passes"));

  const passes = report!.allMetrics.find((m) => m.label === "Passes");
  assert.ok(passes);
  assert.equal(passes!.observations.length, 3);
}

assert.equal(buildStatsBombTeamMedianDistribution(parseStatsBombMatchStatsCsv(MATCH_CSV.slice(0, 120))), null);

console.log("statsBombMedianDistribution.test.ts OK");
