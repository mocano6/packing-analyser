import assert from "node:assert/strict";
import { readFileSync, existsSync } from "fs";
import { parseStatsBombSquadStatsCsv } from "./statsbombCsvParser";
import {
  buildPlayerSetPieceTypeBreakdown,
  resolveSetPieceTypeBreakdownConfig,
} from "./statsBombSetPieceTypeBreakdown";
import { buildPlayerMetricShare } from "./statsBombPlayerMetricShare";

const goalsSample =
  "Player,Minutes,Goals from Corners,Goals from Free Kicks,Goals from Throw-ins,Player SBD ID\n" +
  "CornerTaker,2000,0.18,0.06,0,1\n" +
  "Thrower,1800,0,0,0.12,2\n";
const goalsPlayers = parseStatsBombSquadStatsCsv(goalsSample);
const goalsConfig = resolveSetPieceTypeBreakdownConfig(goalsPlayers);
assert.ok(goalsConfig);
assert.equal(goalsConfig!.mode, "goals");
assert.equal(goalsConfig!.types.length, 3);

const cornerBreakdown = buildPlayerSetPieceTypeBreakdown(goalsPlayers[0]!, goalsConfig!);
assert.equal(cornerBreakdown[0]!.shortLabel, "Róg");
assert.equal(cornerBreakdown[0]!.isDominant, true);
assert.ok(cornerBreakdown[0]!.sharePct > 70);

const throwBreakdown = buildPlayerSetPieceTypeBreakdown(goalsPlayers[1]!, goalsConfig!);
assert.equal(throwBreakdown[0]!.shortLabel, "Aut");
assert.equal(throwBreakdown.length, 1);

const volumeGoalsSample =
  "Player,Minutes,Goals from Corners,Goals from Free Kicks,Goals from Throw-ins,Corners,Free Kicks,Throw-ins,Player SBD ID\n" +
  "Wide,2000,0.04,0.04,0.12,1.0,2.0,5.0,1\n" +
  "Other,1800,0.02,0.01,0,2.0,0.5,0.5,2\n";
const volumeGoalsPlayers = parseStatsBombSquadStatsCsv(volumeGoalsSample);
const volumeConfig = resolveSetPieceTypeBreakdownConfig(volumeGoalsPlayers);
assert.ok(volumeConfig);
assert.equal(volumeConfig!.mode, "goals");

const volumeShare = buildPlayerMetricShare(volumeGoalsPlayers, "Set Piece Goals", 300)!;
assert.ok(volumeShare.setPieceBreakdown);
assert.equal(volumeShare.setPieceBreakdown!.mode, "goals");
const wideRow = volumeShare.rows.find((row) => row.displayName === "Wide");
assert.ok(wideRow?.setPieceTypes?.length === 3);
assert.equal(wideRow!.dominantSetPieceType, "Aut");

const goalsShare = buildPlayerMetricShare(goalsPlayers, "Set Piece Goals", 300)!;
const cornerRow = goalsShare.rows.find((row) => row.displayName === "CornerTaker");
assert.ok(cornerRow?.setPieceTypes);
assert.equal(cornerRow!.dominantSetPieceType, "Róg");

const realPath =
  "/Users/lukaszferszt/Downloads/jaga/fwdiietaprekrutacjizadaniepraktycznejagielloniab/JagielloniaBiałystok-Squad STATS.csv";
if (existsSync(realPath)) {
  const realPlayers = parseStatsBombSquadStatsCsv(readFileSync(realPath, "utf8"));
  const realConfig = resolveSetPieceTypeBreakdownConfig(realPlayers);
  assert.ok(realConfig);
  assert.equal(realConfig!.mode, "volume");
  const realXgShare = buildPlayerMetricShare(realPlayers, "Set Piece xG Assisted", 300)!;
  const wdowik = realXgShare.rows.find((row) => row.displayName.includes("Wdowik"));
  assert.ok(wdowik?.setPieceTypes?.length);
  assert.equal(wdowik!.dominantSetPieceType, "Aut");
}

console.log("statsBombSetPieceTypeBreakdown tests: OK");
