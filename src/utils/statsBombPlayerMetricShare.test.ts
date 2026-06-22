import assert from "node:assert/strict";
import { readFileSync, existsSync } from "fs";
import {
  buildPlayerMetricShare,
  canBuildPlayerMetricShare,
  isShareableTeamMetricLabel,
  resolveSquadMetricColumn,
} from "./statsBombPlayerMetricShare";
import { parseStatsBombSquadStatsCsv } from "./statsbombCsvParser";

const sample =
  "Player,Minutes,Age,OBV,Shot OBV,Passing%,Pressures,Shots Faced,Player SBD ID\n" +
  "Alice,2000,25,0.20,0.10,0.65,12.0,0,1\n" +
  "Bob,1800,27,0.10,0.05,0.70,8.0,0,2\n" +
  "Keeper,1200,28,0.05,0,0.55,0.5,12.0,3\n";

const players = parseStatsBombSquadStatsCsv(sample);

assert.equal(isShareableTeamMetricLabel("Shot OBV"), true);
assert.equal(isShareableTeamMetricLabel("Passing%"), false);
assert.equal(isShareableTeamMetricLabel("Punkty"), false);
assert.equal(isShareableTeamMetricLabel("Goals"), true);
assert.equal(isShareableTeamMetricLabel("xG/Shot"), false);

assert.equal(resolveSquadMetricColumn("Shot OBV", players), "Shot OBV");
assert.equal(resolveSquadMetricColumn("Passing%", players), null);

const goalsSample =
  "Player,Minutes,Goals & Penalty Goals,Non Penalty Goals,Player SBD ID\n" +
  "Striker,2000,0.45,0.40,1\n" +
  "Sub,400,0.10,0.10,2\n";
const goalPlayers = parseStatsBombSquadStatsCsv(goalsSample);
assert.equal(resolveSquadMetricColumn("Goals", goalPlayers), "Goals & Penalty Goals");
const goalsShare = buildPlayerMetricShare(goalPlayers, "Goals", 300);
assert.ok(goalsShare);
assert.equal(goalsShare!.squadColumn, "Goals & Penalty Goals");
assert.equal(goalsShare!.rows[0]!.displayName, "Striker");

const obvShare = buildPlayerMetricShare(players, "Shot OBV", 300);
assert.ok(obvShare);
assert.equal(obvShare!.rows.length, 2);
assert.ok(obvShare!.rows[0]!.sharePct > obvShare!.rows[1]!.sharePct);
const shareSum = obvShare!.rows.reduce((s, r) => s + r.sharePct, 0);
assert.ok(Math.abs(shareSum - 100) < 0.1);

assert.equal(canBuildPlayerMetricShare(players, "OBV", 300), true);
assert.equal(canBuildPlayerMetricShare(players, "Punkty", 300), false);

const pressures = buildPlayerMetricShare(players, "Pressures", 300);
assert.ok(pressures);
assert.equal(pressures!.rows[0]!.displayName, "Alice");

const realPath =
  "/Users/lukaszferszt/Downloads/jaga/fwdiietaprekrutacjizadaniepraktycznejagielloniab/JagielloniaBiałystok-Squad STATS.csv";
if (existsSync(realPath)) {
  const realPlayers = parseStatsBombSquadStatsCsv(readFileSync(realPath, "utf8"));
  assert.ok(canBuildPlayerMetricShare(realPlayers, "Shot OBV", 300));
  const realShare = buildPlayerMetricShare(realPlayers, "Shot OBV", 300)!;
  assert.ok(realShare.rows.length >= 5);
  assert.ok(realShare.rows[0]!.sharePct >= 5);
}

console.log("statsBombPlayerMetricShare tests: OK");
