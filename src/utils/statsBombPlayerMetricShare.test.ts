import assert from "node:assert/strict";
import { readFileSync, existsSync } from "fs";
import {
  buildPlayerMetricShare,
  canBuildPlayerMetricShare,
  canOpenPlayerMetricShareModal,
  canOpenSetPieceGoalsShareModal,
  buildSetPieceGoalsShareViews,
  computeVolumeQualityPerMinute,
  isPlayerRateMetricLabel,
  isShareableTeamMetricLabel,
  resolvePlayerRateMetricColumn,
  resolvePlayerShareMetric,
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
assert.equal(isShareableTeamMetricLabel("Set Piece Goals"), true);
assert.equal(isShareableTeamMetricLabel("xG/Shot"), false);
assert.equal(isPlayerRateMetricLabel("xG/Shot"), true);

const xgShotSample =
  "Player,Minutes,Non Penalty xG/Shot,Non Penalty Shots,Player SBD ID\n" +
  "Striker,2000,0.25,3.0,1\n" +
  "Winger,1800,0.18,2.0,2\n" +
  "Bench,400,0.30,1.0,3\n";
const xgShotPlayers = parseStatsBombSquadStatsCsv(xgShotSample);
assert.equal(resolvePlayerRateMetricColumn("xG/Shot", xgShotPlayers), "Non Penalty xG/Shot");
const xgShotRank = buildPlayerMetricShare(xgShotPlayers, "xG/Shot", 300);
assert.ok(xgShotRank);
assert.equal(xgShotRank!.mode, "rate");
assert.equal(xgShotRank!.sampleLabel, "Strzały");
assert.equal(xgShotRank!.volumeQualityLabel, "xG strz./min");
assert.equal(xgShotRank!.rows[0]!.displayName, "Striker");
assert.ok((xgShotRank!.rows[0]!.volumeQualityPerMinute ?? 0) > (xgShotRank!.rows[1]!.volumeQualityPerMinute ?? 0));
assert.ok((xgShotRank!.rows[1]!.volumeQualityPerMinute ?? 0) > (xgShotRank!.rows[2]!.volumeQualityPerMinute ?? 0));
assert.ok(Math.abs(computeVolumeQualityPerMinute(0.25, 3)! - 0.25 * 3 / 90) < 1e-9);
assert.ok((xgShotRank!.rows[0]!.sampleTotal ?? 0) > 50);
assert.ok(Math.abs((xgShotRank!.rows[1]!.samplePerMinute ?? 0) - 2 / 90) < 1e-9);
assert.equal(canBuildPlayerMetricShare(xgShotPlayers, "xG/Shot", 300), true);

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

const spGoalsSample =
  "Player,Minutes,Set Piece Goals,Player SBD ID\n" +
  "Header,2000,0.24,1\n" +
  "Freekick,1800,0.12,2\n" +
  "Bench,400,0.06,3\n";
const spGoalPlayers = parseStatsBombSquadStatsCsv(spGoalsSample);
assert.ok(resolvePlayerShareMetric("Set Piece Goals", spGoalPlayers));
const spGoalsShare = buildPlayerMetricShare(spGoalPlayers, "Set Piece Goals", 300);
assert.ok(spGoalsShare);
assert.equal(spGoalsShare!.squadColumn, "Set Piece Goals");
assert.equal(spGoalsShare!.rows[0]!.displayName, "Header");
assert.ok(spGoalsShare!.rows[0]!.sharePct > spGoalsShare!.rows[1]!.sharePct);
assert.equal(canBuildPlayerMetricShare(spGoalPlayers, "Set Piece Goals", 300), true);

const spGoalsCompositeSample =
  "Player,Minutes,Goals from Corners,Goals from Free Kicks,Player SBD ID\n" +
  "CornerTaker,2000,0.18,0.06,1\n" +
  "Sub,900,0,0.09,2\n";
const spCompositePlayers = parseStatsBombSquadStatsCsv(spGoalsCompositeSample);
const spCompositeResolved = resolvePlayerShareMetric("Set Piece Goals", spCompositePlayers);
assert.ok(spCompositeResolved);
assert.match(spCompositeResolved!.squadColumn, /Goals from Corners \+ Goals from Free Kicks/);
const spCompositeShare = buildPlayerMetricShare(spCompositePlayers, "Set Piece Goals", 300);
assert.ok(spCompositeShare);
assert.equal(spCompositeShare!.rows[0]!.displayName, "CornerTaker");

const spFallbackSample =
  "Player,Minutes,Set Piece xG Assisted,Goals & Penalty Goals,Non Penalty Goals,Player SBD ID\n" +
  "Creator,2000,0.20,0.38,0.38,1\n" +
  "Other,1800,0.05,0.10,0.10,2\n";
const spFallbackPlayers = parseStatsBombSquadStatsCsv(spFallbackSample);
assert.equal(buildPlayerMetricShare(spFallbackPlayers, "Set Piece Goals", 300), null);
const spFallbackViews = buildSetPieceGoalsShareViews(spFallbackPlayers, 300);
assert.equal(spFallbackViews.goals, null);
assert.ok(spFallbackViews.xgAssisted);
assert.equal(spFallbackViews.xgAssisted!.squadColumn, "Set Piece xG Assisted");
assert.equal(spFallbackViews.xgAssisted!.rows[0]!.displayName, "Creator");
assert.equal(canBuildPlayerMetricShare(spFallbackPlayers, "Set Piece Goals", 300), false);
assert.equal(canOpenSetPieceGoalsShareModal(spFallbackPlayers, 300), true);
assert.equal(canOpenPlayerMetricShareModal(spFallbackPlayers, "Set Piece Goals", 300), true);
assert.ok(canBuildPlayerMetricShare(spFallbackPlayers, "Set Piece xG Assisted", 300));

const obvShare = buildPlayerMetricShare(players, "Shot OBV", 300);
assert.ok(obvShare);
assert.equal(obvShare!.mode, "share");
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
  assert.ok(canBuildPlayerMetricShare(realPlayers, "xG/Shot", 300));
  const realShare = buildPlayerMetricShare(realPlayers, "Shot OBV", 300)!;
  assert.ok(realShare.rows.length >= 5);
  assert.ok(realShare.rows[0]!.sharePct >= 5);
  const realXgShot = buildPlayerMetricShare(realPlayers, "xG/Shot", 300)!;
  assert.equal(realXgShot.mode, "rate");
  assert.ok(realXgShot.rows.length >= 3);
  assert.ok(realXgShot.rows[0]!.volumeQualityPerMinute! >= realXgShot.rows[1]!.volumeQualityPerMinute!);
  assert.ok(canOpenSetPieceGoalsShareModal(realPlayers, 300));
  assert.equal(canBuildPlayerMetricShare(realPlayers, "Set Piece Goals", 300), false);
  const realSpViews = buildSetPieceGoalsShareViews(realPlayers, 300);
  assert.equal(realSpViews.goals, null);
  assert.ok(realSpViews.xgAssisted);
  assert.equal(realSpViews.xgAssisted!.squadColumn, "Set Piece xG Assisted");
  assert.ok(realSpViews.xgAssisted!.rows.length >= 3);
}

console.log("statsBombPlayerMetricShare tests: OK");
