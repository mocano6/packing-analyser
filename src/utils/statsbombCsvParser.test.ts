import assert from "node:assert/strict";
import {
  computeStatsBombOutcomes,
  detectStatsBombCsvKind,
  parseStatsBombMatchLabel,
  parseStatsBombMatchStatsCsv,
  parseStatsBombNumber,
  parseStatsBombSquadStatsCsv,
} from "./statsbombCsvParser";

const SAMPLE_HEADER =
  "Match,Date,Cumulative xG,Goals & Penalty Goals,Shots,Goals Conceded,Opposition xG,Game Week,Neutral Ground,Game SBD ID\n";

assert.equal(parseStatsBombNumber("1.23"), 1.23);
assert.equal(parseStatsBombNumber("false"), 0);
assert.equal(parseStatsBombNumber("true"), 1);
assert.equal(parseStatsBombNumber(""), null);

const home = parseStatsBombMatchLabel("Jagiellonia Białystok vs. Zagłębie Lubin");
assert.equal(home.isHome, true);
assert.equal(home.opponent, "Zagłębie Lubin");

const away = parseStatsBombMatchLabel("Katowice vs. Jagiellonia Białystok");
assert.equal(away.isHome, false);
assert.equal(away.opponent, "Katowice");

const outcomes = computeStatsBombOutcomes({
  "Goals & Penalty Goals": 2,
  "Goals Conceded": 1,
  "Cumulative xG": 1.5,
  "Opposition xG": 0.8,
});
assert.equal(outcomes.gd, 1);
assert.equal(outcomes.win, 1);
assert.equal(outcomes.loss, 0);
assert.equal(outcomes.xgd, 0.7);

const csv =
  SAMPLE_HEADER +
  "Jagiellonia Białystok vs. A,2026-05-23,1.9,1,14,0,1.01,34,false,100\n" +
  "B vs. Jagiellonia Białystok,2026-05-17,2.1,2,22,2,0.85,33,false,101\n";

const rows = parseStatsBombMatchStatsCsv(csv);
assert.equal(rows.length, 2);
const homeRow = rows.find((r) => r.isHome);
const awayRow = rows.find((r) => !r.isHome);
assert.ok(homeRow);
assert.ok(awayRow);
assert.equal(homeRow!.outcomes.goals, 1);
assert.equal(awayRow!.outcomes.goals, 2);
assert.equal(awayRow!.outcomes.draw, 1);

const bomCsv = "\uFEFF" + csv;
assert.equal(parseStatsBombMatchStatsCsv(bomCsv).length, 2);

// Procenty: "55%" -> 55 (skalowanie nie zmienia korelacji).
assert.equal(parseStatsBombNumber("55%"), 55);
assert.equal(parseStatsBombNumber("0.5%"), 0.5);

// CRLF (eksport Excel/StatsBomb): ostatnia kolumna outcome musi być nadal rozpoznana.
const crlfHeader =
  "Match,Date,Cumulative xG,Goals & Penalty Goals,Goals Conceded,Opposition xG\r\n";
const crlfCsv =
  crlfHeader +
  "Jagiellonia Białystok vs. A,2026-05-23,1.9,3,0,0.50\r\n" +
  "Jagiellonia Białystok vs. B,2026-05-17,1.0,1,2,2.40\r\n";
const crlfRows = parseStatsBombMatchStatsCsv(crlfCsv);
assert.equal(crlfRows.length, 2);
// Gdyby "\r" pozostał na nagłówku "Opposition xG", xga byłoby 0 dla wszystkich.
const crlfWin = crlfRows.find((r) => r.outcomes.goals === 3)!;
const crlfLoss = crlfRows.find((r) => r.outcomes.goals === 1)!;
assert.equal(crlfWin.outcomes.xga, 0.5);
assert.equal(crlfLoss.outcomes.xga, 2.4);
assert.equal(crlfWin.outcomes.win, 1);
assert.equal(crlfLoss.outcomes.loss, 1);

assert.equal(detectStatsBombCsvKind(SAMPLE_HEADER + "x\n"), "match");
assert.equal(
  detectStatsBombCsvKind("Player,Minutes,Shots\nA,100,1\n"),
  "squad",
);

const squadCsv =
  "Player,Minutes,Age,Shots,OBV,Player SBD ID\n" +
  "Test Player,1500,24,2.5,0.15,99\n" +
  "Other,800,22,0.5,0.05,100\n";
const squadRows = parseStatsBombSquadStatsCsv(squadCsv);
assert.equal(squadRows.length, 2);
assert.equal(squadRows[0]?.minutes, 1500);
assert.equal(squadRows[0]?.numeric.Shots, 2.5);

console.log("statsbombCsvParser tests: OK");
