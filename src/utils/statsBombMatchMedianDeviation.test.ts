import assert from "node:assert/strict";
import { parseStatsBombMatchStatsCsv } from "./statsbombCsvParser";
import { buildStatsBombTeamMedianDistribution } from "./statsBombTeamMedianDistribution";
import {
  buildStatsBombMatchMedianDeviations,
  rankStatsBombMatchMedianDeviations,
  sortStatsBombMatchMedianDeviations,
  toggleMatchMedianDeviationSort,
} from "./statsBombMatchMedianDeviation";
import { statsBombMatchRowId } from "./statsBombTeamMedianDistribution";

const MATCH_CSV =
  "Match,Date,Cumulative xG,Goals & Penalty Goals,Shots,Passes,Pressures,Goals Conceded,Opposition xG,Game Week,Game SBD ID\n" +
  "Team A vs. Jagiellonia,2024-08-01,1.2,2,12,400,80,0,0.8,1,1\n" +
  "Team B vs. Jagiellonia,2024-08-08,0.8,1,8,350,60,1,1.5,2,2\n" +
  "Team C vs. Jagiellonia,2024-08-15,2.1,3,18,520,110,1,0.5,3,3\n" +
  "Team D vs. Jagiellonia,2024-08-22,0.5,0,5,280,45,2,2.0,4,4\n";

const rows = parseStatsBombMatchStatsCsv(MATCH_CSV);
const report = buildStatsBombTeamMedianDistribution(rows)!;
const highlightId = statsBombMatchRowId(rows[2]!);
const deviations = buildStatsBombMatchMedianDeviations(report, highlightId, rows[2]);

assert.ok(deviations.length >= 5);

const passes = deviations.find((row) => row.label === "Passes");
assert.ok(passes);
assert.equal(passes!.matchValue, 520);
assert.ok(passes!.deviation > 0);
assert.ok(passes!.pctReliable);

const ranked = rankStatsBombMatchMedianDeviations(deviations);
assert.ok(ranked.length >= 3);
assert.ok((ranked[0]!.absDeviationPct ?? ranked[0]!.absDeviation) >= (ranked[1]!.absDeviationPct ?? ranked[1]!.absDeviation));

const sortedByLabel = sortStatsBombMatchMedianDeviations(deviations, "label", "asc");
assert.ok(sortedByLabel[0]!.label.localeCompare(sortedByLabel[1]!.label, "pl") <= 0);

const toggled = toggleMatchMedianDeviationSort("absDeviationPct", "desc", "absDeviationPct");
assert.equal(toggled.direction, "asc");

console.log("statsBombMatchMedianDeviation.test.ts OK");
