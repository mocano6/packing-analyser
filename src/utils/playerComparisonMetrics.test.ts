import assert from "assert";
import type { Player, TeamInfo } from "@/types";
import {
  buildPlayerComparisonRows,
  getMetricLeader,
  resolvePlayerComparisonMetricId,
  supportsComparisonMetricRole,
} from "./playerComparisonMetrics";

const players: Player[] = [
  {
    id: "p1",
    firstName: "Jan",
    lastName: "Kowalski",
    number: 9,
    position: "ST",
    birthYear: 2007,
    teams: ["t1"],
  },
  {
    id: "p2",
    firstName: "Adam",
    lastName: "Nowak",
    number: 8,
    position: "AM",
    birthYear: 2007,
    teams: ["t1"],
  },
  {
    id: "p3",
    firstName: "Piotr",
    lastName: "Zielinski",
    number: 6,
    position: "DM",
    birthYear: 2008,
    teams: ["t1"],
  },
];

const match: TeamInfo = {
  matchId: "m1",
  team: "t1",
  opponent: "opp",
  isHome: true,
  competition: "Liga",
  date: "2026-05-01",
  playerMinutes: [
    { playerId: "p1", startMinute: 0, endMinute: 90 },
    { playerId: "p2", startMinute: 0, endMinute: 45 },
  ],
  actions_packing: [
    {
      id: "a1",
      matchId: "m1",
      teamId: "t1",
      minute: 1,
      actionType: "pass",
      senderId: "p1",
      receiverId: "p2",
      isSecondHalf: false,
      packingPoints: 10,
      xTValueStart: 0.1,
      xTValueEnd: 0.3,
    },
    {
      id: "a2",
      matchId: "m1",
      teamId: "t1",
      minute: 2,
      actionType: "pass",
      senderId: "p3",
      receiverId: "p1",
      isSecondHalf: false,
      packingPoints: 4,
      xTValueStart: 0.2,
      xTValueEnd: 0.25,
    },
    {
      id: "a3",
      matchId: "m1",
      teamId: "t1",
      minute: 3,
      actionType: "dribble",
      senderId: "p2",
      isSecondHalf: false,
      packingPoints: 5,
      xTValueStart: 0.1,
      xTValueEnd: 0.2,
    },
  ],
  shots: [
    {
      id: "s1",
      matchId: "m1",
      teamId: "t1",
      teamContext: "attack",
      playerId: "p1",
      x: 50,
      y: 50,
      minute: 10,
      timestamp: 1,
      xG: 0.4,
      isGoal: false,
      shotType: "on_target",
    },
    {
      id: "s2",
      matchId: "m1",
      teamId: "t1",
      teamContext: "attack",
      playerId: "p2",
      x: 55,
      y: 48,
      minute: 11,
      timestamp: 2,
      xG: 0.1,
      isGoal: false,
      shotType: "off_target",
    },
    {
      id: "s3",
      matchId: "m1",
      teamId: "t1",
      teamContext: "attack",
      playerId: "p2",
      x: 52,
      y: 52,
      minute: 12,
      timestamp: 3,
      xG: 0.5,
      isGoal: true,
      isOwnGoal: false,
      shotType: "goal",
    },
  ],
  pkEntries: [
    {
      id: "pk1",
      matchId: "m1",
      teamId: "t1",
      teamContext: "attack",
      senderId: "p2",
      receiverId: "p1",
      startX: 40,
      startY: 50,
      endX: 80,
      endY: 50,
      minute: 20,
      timestamp: 2,
      isSecondHalf: false,
      entryType: "pass",
    },
    {
      id: "pk2",
      matchId: "m1",
      teamId: "t1",
      teamContext: "attack",
      senderId: "p3",
      startX: 45,
      startY: 40,
      endX: 82,
      endY: 45,
      minute: 22,
      timestamp: 3,
      isSecondHalf: false,
      entryType: "dribble",
    },
  ],
  actions_regain: [
    {
      id: "r1",
      matchId: "m1",
      teamId: "t1",
      minute: 30,
      actionType: "regain",
      senderId: "p2",
      isSecondHalf: false,
      regainAttackXT: 0.3,
      regainDefenseXT: 0.1,
    },
  ],
  actions_loses: [
    {
      id: "l1",
      matchId: "m1",
      teamId: "t1",
      minute: 40,
      actionType: "lose",
      senderId: "p2",
      isSecondHalf: false,
      losesAttackXT: 0.22,
    },
    {
      id: "l2",
      matchId: "m1",
      teamId: "t1",
      minute: 41,
      actionType: "lose",
      senderId: "p2",
      isSecondHalf: false,
      isAut: true,
      losesAttackXT: 0.5,
    },
  ],
};

const sumResult = buildPlayerComparisonRows(players, [match], "sum");
const p1 = sumResult.rows.find((row) => row.playerId === "p1");
const p2 = sumResult.rows.find((row) => row.playerId === "p2");
const p3 = sumResult.rows.find((row) => row.playerId === "p3");

assert.ok(p1);
assert.ok(p2);
assert.ok(p3);
assert.equal(sumResult.usedPer90Fallback, false);
assert.equal(p1.minutes, 90);
assert.equal(p2.minutes, 45);
assert.equal(p3.minutes, 0);
assert.equal(p1.playerName, "Kowalski Jan");
assert.equal(p1.matchesPlayed, 1);
assert.equal(p2.matchesPlayed, 1);
assert.equal(p3.matchesPlayed, 0);
assert.equal(p1.raw.packing, 7);
assert.ok(Math.abs(p1.raw.pxt - 1.1) < 1e-9);
assert.ok(Math.abs(p1.raw.pxtSender - 2) < 1e-9);
assert.ok(Math.abs(p1.raw.pxtReceiver - 0.2) < 1e-9);
assert.ok(Math.abs(p1.raw.xt - 0.125) < 1e-9);
assert.ok(Math.abs(p1.raw.xtSender - 0.2) < 1e-9);
assert.ok(Math.abs(p1.raw.xtReceiver - 0.05) < 1e-9);
assert.equal(p1.raw.xg, 0.4);
assert.equal(p1.raw.shots, 1);
assert.equal(p1.raw.goals, 0);
assert.ok(Math.abs(p1.values.xgPerShot - 0.4) < 1e-9);
assert.equal(Number.isFinite(p1.values.shotsPerGoal), false);
assert.equal(Number.isFinite(p1.values.xgPerGoal), false);
assert.equal(p2.raw.shots, 2);
assert.equal(p2.raw.goals, 1);
assert.ok(Math.abs(p2.raw.xg - 0.6) < 1e-9);
assert.ok(Math.abs(p2.values.xgPerShot - 0.3) < 1e-9);
assert.ok(Math.abs(p2.values.shotsPerGoal - 2) < 1e-9);
assert.ok(Math.abs(p2.values.xgPerGoal - 0.6) < 1e-9);
assert.equal(p1.raw.pkEntries, 0.5);
assert.equal(p1.raw.pkEntriesReceiver, 1);
assert.equal(p2.raw.pkEntriesSender, 1);
assert.equal(p3.raw.pkEntriesDribble, 1);
assert.equal(p2.raw.regains, 1);
assert.ok(Math.abs(p2.raw.regainsXt - 0.2) < 1e-9);
assert.equal(p2.raw.loses, 1);
assert.equal(p2.raw.losesXt, 0.22);
assert.ok(Math.abs((p2.raw.pxtDribble ?? 0) - 0.5) < 1e-9);
assert.ok(Math.abs((p2.raw.xtDribble ?? 0) - 0.1) < 1e-9);

assert.equal(resolvePlayerComparisonMetricId("pxt", "receiver"), "pxtReceiver");
assert.equal(resolvePlayerComparisonMetricId("pkEntries", "dribble"), "pkEntriesDribble");
assert.equal(resolvePlayerComparisonMetricId("xg", "dribble"), "xg");
assert.equal(supportsComparisonMetricRole("pxt"), true);
assert.equal(supportsComparisonMetricRole("xg"), false);

const per90Result = buildPlayerComparisonRows(players, [match], "per90");
const p2Per90 = per90Result.rows.find((row) => row.playerId === "p2");
assert.ok(p2Per90);
assert.equal(per90Result.usedPer90Fallback, true);
assert.equal(p2Per90.values.regains, 2);
assert.equal(p2Per90.values.loses, 2);

const losesLeader = getMetricLeader(sumResult.rows, "loses");
assert.equal(losesLeader?.playerId, "p1");

console.log("playerComparisonMetrics tests: OK");
