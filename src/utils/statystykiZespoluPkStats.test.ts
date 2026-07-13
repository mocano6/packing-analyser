import assert from "node:assert/strict";
import type { PKEntry, TeamInfo } from "@/types";
import {
  buildCumulativePkChartData,
  buildPk5MinChartData,
  buildPlayerPkRows,
  buildTeamAndOpponentPkStats,
  filterPkEntriesByHalf,
  getMatchPkEntries,
  getSidePkEntries,
  mergePkBreakdownRows,
} from "./statystykiZespoluPkStats";
import { buildWiedzaPkEntriesSummary } from "./wiedzaPkEntriesSummary";

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

const teamAttack: PKEntry = {
  id: "pk1",
  matchId: "m1",
  teamId: "home",
  startX: 70,
  startY: 50,
  endX: 85,
  endY: 50,
  minute: 12,
  isSecondHalf: false,
  entryType: "pass",
  teamContext: "attack",
  isShot: true,
  isGoal: true,
  senderId: "p1",
  receiverId: "p2",
  pkPlayersCount: 3,
  opponentsInPKCount: 2,
  timestamp: 1,
} as PKEntry;

const oppDefense: PKEntry = {
  id: "pk2",
  matchId: "m1",
  teamId: "home",
  startX: 30,
  startY: 50,
  endX: 15,
  endY: 50,
  minute: 55,
  isSecondHalf: true,
  entryType: "dribble",
  teamContext: "defense",
  isRegain: true,
  senderId: "p9",
  timestamp: 2,
} as PKEntry;

const all = [teamAttack, oppDefense];

assert.equal(filterPkEntriesByHalf(all, "first").length, 1);
assert.equal(filterPkEntriesByHalf(all, "second").length, 1);
assert.equal(getMatchPkEntries(all, "home").length, 2);
assert.equal(getSidePkEntries(all, "team").length, 1);
assert.equal(getSidePkEntries(all, "opponent").length, 1);

const pair = buildTeamAndOpponentPkStats(all, match, "home", "all");
assert.equal(pair.teamStats.entries, 1);
assert.equal(pair.teamStats.goals, 1);
assert.equal(pair.opponentStats.entries, 1);
assert.equal(pair.opponentStats.regains, 1);
assert.equal(pair.teamStats.entriesDominancePct, 50);
assert.equal(pair.opponentStats.entriesDominancePct, 50);

const players = buildPlayerPkRows(getSidePkEntries(all, "team"), pair.teamStats.entries, (id) => `Player ${id}`);
assert.equal(players.length, 2);
assert.ok(players.some((p) => p.entries >= 1));

const cumulative = buildCumulativePkChartData(all, "home");
assert.equal(cumulative.length, 2);
assert.equal(cumulative[1].teamEntries, 1);

const intervals = buildPk5MinChartData(all, "home");
assert.equal(intervals.length, 19);
assert.ok(intervals.some((p) => p.teamTotal > 0));
assert.ok(intervals.some((p) => p.oppTotal > 0));

const grouped = mergePkBreakdownRows(
  buildWiedzaPkEntriesSummary([teamAttack]).byEntryType,
  buildWiedzaPkEntriesSummary([oppDefense]).byEntryType,
);
assert.equal(grouped.length, 2);

console.log("statystykiZespoluPkStats.test.ts — OK");
