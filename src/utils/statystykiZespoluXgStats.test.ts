import assert from "node:assert/strict";
import {
  buildCumulativeXgChartData,
  buildPlayerXgRows,
  buildTeamAndOpponentStats,
  buildTeamSideStats,
  buildXg5MinChartData,
  buildSideShotsSummary,
  eventVideoTimestampSec,
  filterShotsByCategory,
  filterShotsByHalf,
  filterShotsForMap,
  getDefenseShotsFaced,
  resolveAcc8sSideTeamId,
  summarizeGoalkeeperSaves,
  summarizeXgAfterStartWindows,
  resolveShotTeamIdForSelectedTeam,
  XG_PER_SHOT_KPI,
} from "./statystykiZespoluXgStats";
import type { Shot, TeamInfo } from "@/types";

const match = {
  id: "m1",
  team: "home",
  opponent: "away",
  isHome: true,
  competition: "test",
  date: "2024-01-01",
  matchData: {
    possession: { teamFirstHalf: 20, teamSecondHalf: 25, opponentFirstHalf: 18, opponentSecondHalf: 22 },
  },
} as TeamInfo;

const homeShot: Shot = {
  id: "s1",
  minute: 10,
  xG: 0.2,
  teamContext: "attack",
  actionType: "open_play",
  shotType: "on_target",
  linePlayersCount: 1,
} as Shot;

const awayShot: Shot = {
  id: "s2",
  minute: 50,
  xG: 0.1,
  teamContext: "defense",
  actionType: "corner",
  shotType: "off_target",
  linePlayers: ["p1"],
} as Shot;

const penaltyShot: Shot = {
  id: "s3",
  minute: 30,
  xG: 0.76,
  teamContext: "attack",
  actionType: "penalty",
  shotType: "goal",
  isGoal: true,
  linePlayersCount: 0,
} as Shot;

assert.equal(XG_PER_SHOT_KPI, 0.15);

assert.equal(filterShotsByHalf([homeShot, awayShot], "first").length, 1);
assert.equal(filterShotsByHalf([homeShot, awayShot], "second").length, 1);

assert.equal(filterShotsByCategory([homeShot, awayShot], "sfg").length, 1);
assert.equal(filterShotsByCategory([homeShot, penaltyShot], "open_play").length, 1);

assert.equal(resolveShotTeamIdForSelectedTeam(homeShot, match, "home"), "home");
assert.equal(resolveShotTeamIdForSelectedTeam(awayShot, match, "home"), "away");

const mapFiltered = filterShotsForMap([homeShot, awayShot], {
  bodyPart: "all",
  sfg: true,
  regain: false,
  goal: false,
  blocked: false,
  onTarget: false,
});
assert.equal(mapFiltered.length, 1);
assert.equal(mapFiltered[0].id, "s2");

const statsShots = [homeShot, penaltyShot];
const teamStats = buildTeamSideStats(statsShots, match, "home", "all", "team");
assert.equal(teamStats.shots, 2);
assert.equal(teamStats.goals, 1);
assert.ok(Math.abs(teamStats.xg - 0.96) < 0.001);
assert.ok(Math.abs(teamStats.npXg - 0.2) < 0.001);
assert.equal(teamStats.cleanShots, 1);
assert.ok(Math.abs(teamStats.avgLinePlayers - 0.5) < 0.001);
assert.ok(teamStats.conversionPct >= 0);
assert.equal(teamStats.penaltyShots, 1);
assert.ok(Math.abs(teamStats.xgPenalty - 0.76) < 0.001);

const pair = buildTeamAndOpponentStats([homeShot, awayShot, penaltyShot], match, "home", "all");
assert.ok(pair.teamStats.xgDominancePct > pair.opponentStats.xgDominancePct);

const teamSummary = buildSideShotsSummary([homeShot, penaltyShot], match, "home", "team");
assert.equal(teamSummary.totalShots, 2);

const players = buildPlayerXgRows(statsShots, teamStats.xg, (id) => `Player ${id}`);
assert.equal(players.length, 1);
assert.ok(players[0].xgPerShot > 0);
assert.ok(Math.abs(players[0].xgOnTarget - 0.96) < 0.001);
assert.equal(players[0].shotsOnTarget, 2);

const gkDefenseShot: Shot = {
  id: "s4",
  minute: 55,
  xG: 0.35,
  teamContext: "defense",
  teamId: "away",
  shotType: "on_target",
  playerId: "gk1",
} as Shot;
const defenseFaced = getDefenseShotsFaced([gkDefenseShot], match, "home", "team");
assert.equal(defenseFaced.length, 1);
const gkRows = buildPlayerXgRows([], 0, (id) => `GK ${id}`, defenseFaced);
assert.equal(gkRows.length, 1);
assert.ok(Math.abs(gkRows[0].xgOnTarget - 0.35) < 0.001);
assert.equal(gkRows[0].shotsOnTarget, 1);
assert.equal(gkRows[0].shots, 0);

const gkGoalShot: Shot = {
  id: "s5",
  minute: 60,
  xG: 0.8,
  teamContext: "defense",
  teamId: "away",
  shotType: "goal",
  isGoal: true,
  playerId: "gk1",
} as Shot;
const gkSummary = summarizeGoalkeeperSaves([gkDefenseShot, gkGoalShot]);
assert.equal(gkSummary.onTargetFaced, 2);
assert.equal(gkSummary.savesOnTarget, 1);
assert.equal(gkSummary.goalsConcededOnTarget, 1);
assert.equal(Math.round(gkSummary.savePct), 50);

const teamWithGk = buildTeamSideStats([gkDefenseShot, gkGoalShot], match, "home", "all", "team");
assert.equal(teamWithGk.gkOnTargetFaced, 2);
assert.equal(teamWithGk.gkSavesOnTarget, 1);
assert.equal(teamWithGk.gkGoalsConcededOnTarget, 1);
assert.equal(Math.round(teamWithGk.gkSavePct), 50);

const gkBlockedShot: Shot = {
  id: "s6",
  minute: 70,
  xG: 0.2,
  teamContext: "defense",
  teamId: "away",
  shotType: "blocked",
  playerId: "gk1",
} as Shot;
const gkWithBlocked = summarizeGoalkeeperSaves([gkDefenseShot, gkGoalShot, gkBlockedShot]);
assert.equal(gkWithBlocked.onTargetFaced, 2);
assert.equal(gkWithBlocked.savesOnTarget, 1);
assert.equal(gkWithBlocked.goalsConcededOnTarget, 1);

const cumulative = buildCumulativeXgChartData([homeShot, awayShot], match, "home");
assert.equal(cumulative.length, 2);
assert.ok(cumulative[1].teamXG >= cumulative[0].teamXG);

const intervals = buildXg5MinChartData([homeShot, awayShot, penaltyShot], match, "home");
assert.equal(intervals.length, 19);
assert.ok(intervals.some((p) => p.teamXG > 0));
assert.ok(intervals.some((p) => p.opponentXG > 0));

assert.equal(eventVideoTimestampSec({ videoTimestampRaw: 120 }), 120);
assert.equal(eventVideoTimestampSec({ videoTimestamp: 80 }), 80);
assert.equal(eventVideoTimestampSec({}), 0);
assert.equal(resolveAcc8sSideTeamId({ teamContext: "attack" }, "home", "away"), "home");
assert.equal(resolveAcc8sSideTeamId({ teamContext: "defense" }, "home", "away"), "away");
assert.equal(resolveAcc8sSideTeamId({ teamId: "away", teamContext: "attack" }, "home", "away"), "away");

{
  const windows = summarizeXgAfterStartWindows(
    [
      { teamId: "home", timestamp: 100 },
      { teamId: "home", timestamp: 104 },
      { teamId: "away", timestamp: 200 },
    ],
    [
      { id: "s1", teamId: "home", timestamp: 107, xG: 0.3, isGoal: true },
      { id: "s2", teamId: "home", timestamp: 113, xG: 0.2, isGoal: false },
      { id: "s3", teamId: "away", timestamp: 205, xG: 0.15, isGoal: false },
      { id: "s4", teamId: "home", timestamp: 100, xG: 0.9, isGoal: false },
    ],
  );
  const home = windows.get("home");
  const away = windows.get("away");
  assert.ok(home);
  assert.ok(away);
  assert.equal(home.shots, 1);
  assert.equal(home.goals, 1);
  assert.equal(home.xg, 0.3);
  assert.equal(away.xg, 0.15);
}

console.log("statystykiZespoluXgStats.test.ts — OK");
