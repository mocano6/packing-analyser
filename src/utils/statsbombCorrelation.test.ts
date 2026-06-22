import assert from "node:assert/strict";
import { parseStatsBombMatchStatsCsv } from "./statsbombCsvParser";
import {
  buildStatsBombCorrelation,
  getStatsBombCsvColumnMetrics,
  metricIdFromColumn,
} from "./statsbombCorrelation";

const csv =
  "Match,Date,Cumulative xG,Goals & Penalty Goals,Shots,Goals Conceded,Opposition xG,Pressures,Game Week,Game SBD ID\n" +
  "Jagiellonia Białystok vs. A,2026-01-01,2.0,3,20,0,0.5,100,1,1\n" +
  "Jagiellonia Białystok vs. B,2026-01-08,1.0,1,10,1,1.0,50,2,2\n" +
  "Jagiellonia Białystok vs. C,2026-01-15,0.5,0,5,2,2.0,30,3,3\n";

const rows = parseStatsBombMatchStatsCsv(csv);
const corr = buildStatsBombCorrelation(rows, 3);
assert.ok(corr);
assert.ok(corr!.metrics.length > 5);
assert.equal(corr!.matrix.length, corr!.metrics.length);

const gdIdx = corr!.metrics.findIndex((m) => m.id === "sb_gd");
const goalsIdx = corr!.metrics.findIndex((m) => m.id === "sb_goals");
const shotsIdx = corr!.metrics.findIndex((m) => m.label === "Shots");
assert.ok(gdIdx >= 0 && goalsIdx >= 0 && shotsIdx >= 0);

// r(GD, Gole) — ręcznie na 3 meczach
const gds = rows.map((r) => r.outcomes.gd);
const gls = rows.map((r) => r.outcomes.goals);
const meanG = gds.reduce((a, b) => a + b, 0) / gds.length;
const meanL = gls.reduce((a, b) => a + b, 0) / gls.length;
let num = 0;
let denX = 0;
let denY = 0;
for (let i = 0; i < gds.length; i++) {
  const dx = gds[i] - meanG;
  const dy = gls[i] - meanL;
  num += dx * dy;
  denX += dx * dx;
  denY += dy * dy;
}
const manual = num / Math.sqrt(denX * denY);
assert.ok(Math.abs((corr!.matrix[gdIdx][goalsIdx] ?? 0) - manual) < 1e-9);

const rShotsWin = corr!.matrix[corr!.metrics.findIndex((m) => m.id === "sb_win")][shotsIdx];
assert.ok(rShotsWin !== null && rShotsWin > 0.9);

assert.ok(corr!.metrics.some((m) => m.label === "Shots" && m.description));

assert.equal(
  metricIdFromColumn("Line Breaking Passes Completed"),
  "sb_col_line_breaking_passes_completed",
);
assert.equal(
  metricIdFromColumn("Line Breaking Passes Completed%"),
  "sb_col_line_breaking_passes_completed_pct",
);
assert.notEqual(
  metricIdFromColumn("Line Breaking Passes Completed"),
  metricIdFromColumn("Line Breaking Passes Completed%"),
);

const pctRows = parseStatsBombMatchStatsCsv(
  "Match,Date,Cumulative xG,Goals & Penalty Goals,Goals Conceded,Opposition xG,Pressures,Pressures%,Game Week,Game SBD ID\n" +
    "Jagiellonia Białystok vs. A,2026-01-01,1,1,0,0.5,10,50,1,1\n" +
    "Jagiellonia Białystok vs. B,2026-01-08,1,1,0,0.5,20,60,2,2\n" +
    "Jagiellonia Białystok vs. C,2026-01-15,1,1,0,0.5,30,70,3,3\n",
);
const pctMetrics = getStatsBombCsvColumnMetrics(pctRows);
const pctIds = pctMetrics.map((m) => m.id);
assert.equal(new Set(pctIds).size, pctIds.length, "CSV metric ids must be unique");

console.log("statsbombCorrelation tests: OK");
