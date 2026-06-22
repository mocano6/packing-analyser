import assert from "node:assert/strict";
import { parseStatsBombMatchStatsCsv } from "./statsbombCsvParser";
import {
  buildStatsBombTeamReport,
  classifyStatsBombReportPhase,
  STATSBOMB_STRONG_CORR_THRESHOLD,
} from "./statsBombTeamReport";

const csv =
  "Match,Date,Cumulative xG,Goals & Penalty Goals,Shots,Touches in box,Goals Conceded,Opposition xG,Pressures,Game Week,Game SBD ID\n" +
  "Jagiellonia Białystok vs. A,2026-01-01,2.5,3,18,12,0,0.4,120,1,1\n" +
  "Jagiellonia Białystok vs. B,2026-01-08,1.2,1,9,5,1,1.1,80,2,2\n" +
  "Jagiellonia Białystok vs. C,2026-01-15,0.8,0,6,3,2,2.2,60,3,3\n" +
  "Jagiellonia Białystok vs. D,2026-01-22,2.0,2,15,10,1,0.9,100,4,4\n";

const rows = parseStatsBombMatchStatsCsv(csv);
const report = buildStatsBombTeamReport(rows, 3);
assert.ok(report);
assert.equal(report!.summary.matchCount, 4);
assert.equal(report!.summary.wins, 2);
assert.equal(report!.summary.losses, 1);

assert.ok(report!.ranked.length > 0);
assert.ok(report!.ranked[0].absRPoints >= report!.ranked[report!.ranked.length - 1].absRPoints);

const xgRow = report!.xgRows.find((row) => row.id === "sb_xg" || row.label === "xG");
assert.ok(xgRow);
assert.ok(xgRow!.rPoints !== null && xgRow!.rPoints > 0);

const pkRow = report!.pkRows.find((row) => row.label === "Touches in box");
assert.ok(pkRow);

assert.equal(classifyStatsBombReportPhase("Opposition xG", "opp"), "defense");
assert.equal(classifyStatsBombReportPhase("Shots", "neutral"), "attack");
assert.equal(classifyStatsBombReportPhase("Pressures", "neutral"), "general");

assert.ok(STATSBOMB_STRONG_CORR_THRESHOLD > 0);

console.log("statsBombTeamReport tests: OK");
