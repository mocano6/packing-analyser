import assert from "assert";
import type { Player, TeamInfo } from "@/types";
import {
  buildPlayerComparisonRows,
  formatPlayerComparisonGroupSurplusParen,
  formatPlayerComparisonRawSurplusParen,
  getMetricLeader,
  getPlayerComparisonAxisDisplay,
  getPlayerComparisonGroupCellTones,
  getPlayerComparisonPairCellTone,
  getPlayerComparisonRawAmountSide,
  normalizePlayerComparisonRadarScore,
  resolveComparisonAxisValueId,
  resolvePlayerComparisonMetricId,
  supportsComparisonMetricDribbleRole,
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
      isP3: true,
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
    {
      id: "s4",
      matchId: "m1",
      teamId: "opp",
      teamContext: "defense",
      playerId: "opp-striker",
      x: 50,
      y: 50,
      minute: 50,
      timestamp: 4,
      xG: 0.35,
      isGoal: false,
      shotType: "blocked",
      linePlayers: ["p3", "p2"],
      blockingPlayers: ["p3"],
    },
    {
      id: "s5",
      matchId: "m1",
      teamId: "opp",
      teamContext: "defense",
      playerId: "opp-striker",
      x: 48,
      y: 52,
      minute: 51,
      timestamp: 5,
      xG: 0.2,
      isGoal: false,
      shotType: "on_target",
      linePlayers: ["p3"],
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
      regainAttackZone: "D7",
      regainAttackXT: 0.3,
      regainDefenseXT: 0.1,
    },
    {
      id: "r2",
      matchId: "m1",
      teamId: "t1",
      minute: 31,
      actionType: "regain",
      senderId: "p2",
      isSecondHalf: false,
      regainAttackZone: "C3",
      regainAttackXT: 0.1,
      regainDefenseXT: 0.05,
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
      losesAttackZone: "D7",
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
    {
      id: "l3",
      matchId: "m1",
      teamId: "t1",
      minute: 42,
      actionType: "lose",
      senderId: "p2",
      isSecondHalf: false,
      losesAttackZone: "C3",
      losesAttackXT: 0.08,
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
assert.equal(p2.raw.regains, 2);
assert.equal(p2.raw.regainsOwnHalf, 1);
assert.equal(p2.raw.regainsOpponentHalf, 1);
assert.ok(Math.abs(p2.raw.regainsXtAttack - 0.4) < 1e-9);
assert.ok(Math.abs(p2.raw.regainsXtDefense - 0.15) < 1e-9);
assert.ok(Math.abs(p2.raw.regainsXt - 0.25) < 1e-9);
assert.equal(p2.raw.loses, 2);
assert.equal(p2.raw.losesOwnHalf, 1);
assert.equal(p2.raw.losesOpponentHalf, 1);
assert.equal(p2.raw.losesXt, 0.3);
assert.ok(Math.abs(p2.raw.losesXtAttack - 0.22) < 1e-9);
assert.ok(Math.abs(p2.raw.losesXtDefense - 0.08) < 1e-9);
assert.ok(Math.abs((p2.raw.pxtDribble ?? 0) - 0.5) < 1e-9);
assert.ok(Math.abs((p2.raw.xtDribble ?? 0) - 0.1) < 1e-9);
assert.equal(p2.raw.phaseP3Sender, 0);
assert.equal(p2.raw.phaseP3Dribble, 1);
assert.equal(p2.raw.phaseP3Receiver, 0);
assert.equal(p2.raw.defenseShotLine, 1);
assert.equal(p2.raw.defenseShotBlockXg, 0);
assert.equal(p3.raw.defenseShotLine, 2);
assert.ok(Math.abs(p3.raw.defenseShotBlockXg - 0.35) < 1e-9);
assert.equal(p3.eventStats.defenseShotLine?.total, 2);
assert.equal(p3.eventStats.defenseShotLine?.successful, 1);
assert.equal(p3.eventStats.defenseShotBlockXg?.total, 1);
assert.equal(p3.eventStats.defenseShotBlockXg?.successful, 0);
assert.equal(p3.eventStats.defenseShotBlockXg?.total, 1);
assert.equal(p2.eventStats.defenseShotLine?.total, 1);
assert.equal(p2.eventStats.defenseShotLine?.successful, 1);

assert.equal(resolvePlayerComparisonMetricId("pxt", "receiver"), "pxtReceiver");
assert.equal(resolvePlayerComparisonMetricId("pkEntries", "dribble"), "pkEntriesDribble");
assert.equal(resolvePlayerComparisonMetricId("phaseP1", "receiver"), "phaseP1Receiver");
assert.equal(resolvePlayerComparisonMetricId("phaseP1", "dribble"), "phaseP1Dribble");
assert.equal(supportsComparisonMetricRole("phaseP1"), true);
assert.equal(supportsComparisonMetricDribbleRole("phaseP1"), true);
assert.equal(supportsComparisonMetricDribbleRole("pxt"), true);
assert.equal(supportsComparisonMetricRole("xg"), false);
assert.strictEqual(resolveComparisonAxisValueId("packing", "receiver"), "packing");
assert.strictEqual(resolveComparisonAxisValueId("phaseP2", "dribble"), "phaseP2Dribble");
assert.equal(resolvePlayerComparisonMetricId("xg", "dribble"), "xg");

assert.equal(getPlayerComparisonAxisDisplay("phaseP1", "sender").radarAxis, "P1 pod.");
assert.equal(getPlayerComparisonAxisDisplay("phaseP1", "dribble").compareTable, "P1 (drybling)");
assert.equal(getPlayerComparisonAxisDisplay("phaseP1", "dribble").radarAxis, "P1 dr.");
assert.equal(getPlayerComparisonAxisDisplay("phaseP3", "receiver").compareTable, "P3 (przyjęcie)");
assert.equal(getPlayerComparisonAxisDisplay("packing", "receiver").radarAxis, "Packing");

const rLoss = sumResult.rows;
assert.ok(rLoss.length >= 2);
const worstLoses = rLoss.reduce((w, r) => (r.values.loses > w.values.loses ? r : w), rLoss[0]);
const bestLoses = rLoss.reduce((w, r) => (r.values.loses < w.values.loses ? r : w), rLoss[0]);
if (worstLoses.values.loses > bestLoses.values.loses) {
  assert.ok(
    normalizePlayerComparisonRadarScore(rLoss, worstLoses, "loses") >
      normalizePlayerComparisonRadarScore(rLoss, bestLoses, "loses"),
  );
}
const packingLeader = rLoss.reduce((b, r) => (r.values.packing > b.values.packing ? r : b), rLoss[0]);
assert.equal(normalizePlayerComparisonRadarScore(rLoss, packingLeader, "packing"), 100);

assert.deepStrictEqual(getPlayerComparisonPairCellTone(10, 5, "higher", "goals"), { primary: "better", secondary: "worse" });
assert.deepStrictEqual(getPlayerComparisonPairCellTone(5, 10, "lower", "goals"), { primary: "better", secondary: "worse" });
assert.deepStrictEqual(getPlayerComparisonPairCellTone(10, 5, "lower", "goals"), { primary: "worse", secondary: "better" });
assert.deepStrictEqual(getPlayerComparisonPairCellTone(3, 3, "higher", "goals"), { primary: "even", secondary: "even" });
/** Te same cyfry co w UI (2 miejsca po przecinku) — surowe float różnią się poza precyzją wyświetlania. */
assert.deepStrictEqual(getPlayerComparisonPairCellTone(1.231, 1.229, "higher", "pxtSender"), {
  primary: "even",
  secondary: "even",
});
assert.equal(getPlayerComparisonRawAmountSide(8, 3, "goals"), "primaryMore");
assert.equal(getPlayerComparisonRawAmountSide(3, 8, "goals"), "secondaryMore");

assert.strictEqual(formatPlayerComparisonRawSurplusParen("packing", 4, 5.2, "pl-PL"), null);
assert.strictEqual(formatPlayerComparisonRawSurplusParen("packing", 5.2, 4, "pl-PL"), "(+1,2)");
assert.strictEqual(formatPlayerComparisonRawSurplusParen("goals", 5, 2, "pl-PL"), "(+3)");
assert.strictEqual(formatPlayerComparisonRawSurplusParen("goals", 2, 2, "pl-PL"), null);
assert.strictEqual(formatPlayerComparisonRawSurplusParen("goals", Number.NaN, 1, "pl-PL"), null);

assert.deepEqual(getPlayerComparisonGroupCellTones([10, 7, 4], "higher", "goals"), [
  "better",
  "neutral",
  "worse",
]);
assert.deepEqual(getPlayerComparisonGroupCellTones([10, 4, 1], "lower", "loses"), [
  "worse",
  "neutral",
  "better",
]);
assert.deepEqual(getPlayerComparisonGroupCellTones([3, 3, 3], "higher", "goals"), [
  "even",
  "even",
  "even",
]);
assert.strictEqual(
  formatPlayerComparisonGroupSurplusParen("goals", 8, [5, 3], "pl-PL"),
  "(+3)",
);
assert.strictEqual(formatPlayerComparisonGroupSurplusParen("goals", 5, [8, 3], "pl-PL"), null);

const phaseMatch: TeamInfo = {
  matchId: "m-phase",
  team: "t1",
  opponent: "opp",
  isHome: true,
  competition: "Liga",
  date: "2026-05-02",
  playerMinutes: [{ playerId: "p1", startMinute: 0, endMinute: 90 }],
  actions_packing: [
    {
      id: "ap-phase",
      matchId: "m-phase",
      teamId: "t1",
      minute: 1,
      actionType: "pass",
      senderId: "p1",
      receiverId: "p2",
      isSecondHalf: false,
      packingPoints: 20,
      xTValueStart: 0.1,
      xTValueEnd: 0.3,
      isP1: true,
    },
  ],
  shots: [],
  pkEntries: [],
  actions_regain: [],
  actions_loses: [],
};

const rParticipation = buildPlayerComparisonRows(players, [phaseMatch], "sum");
const p1Part = rParticipation.rows.find((r) => r.playerId === "p1");
const p2Part = rParticipation.rows.find((r) => r.playerId === "p2");
assert.ok(p1Part && p2Part);
assert.equal(p1Part.raw.phaseP1Sender, 1);
assert.equal(p1Part.raw.phaseP1Receiver, 0);
assert.equal(p1Part.raw.phaseP1Dribble, 0);
assert.equal(p2Part.raw.phaseP1Receiver, 1);
assert.equal(p2Part.raw.phaseP1Sender, 0);
assert.ok(p1Part.raw.packing > 0);

const per90Result = buildPlayerComparisonRows(players, [match], "per90");
const p2Per90 = per90Result.rows.find((row) => row.playerId === "p2");
assert.ok(p2Per90);
assert.equal(per90Result.usedPer90Fallback, true);
assert.equal(p2Per90.values.regains, 4);
assert.equal(p2Per90.values.regainsOwnHalf, 2);
assert.equal(p2Per90.values.regainsOpponentHalf, 2);
assert.equal(p2Per90.values.loses, 4);
assert.equal(p2Per90.values.losesOwnHalf, 2);
assert.equal(p2Per90.values.losesOpponentHalf, 2);

const losesLeader = getMetricLeader(sumResult.rows, "loses");
assert.equal(losesLeader?.playerId, "p1");

const penaltyMatch: TeamInfo = {
  ...match,
  matchId: "m-penalty",
  shots: [
    {
      id: "sp1",
      matchId: "m-penalty",
      teamId: "t1",
      teamContext: "attack",
      playerId: "p1",
      x: 50,
      y: 50,
      minute: 5,
      timestamp: 1,
      xG: 0.2,
      actionType: "open_play",
      isGoal: true,
      isOwnGoal: false,
      shotType: "goal",
    },
    {
      id: "sp2",
      matchId: "m-penalty",
      teamId: "t1",
      teamContext: "attack",
      playerId: "p1",
      x: 88,
      y: 50,
      minute: 6,
      timestamp: 2,
      xG: 0.76,
      actionType: "penalty",
      isGoal: true,
      isOwnGoal: false,
      shotType: "goal",
    },
  ],
};

const penaltyResult = buildPlayerComparisonRows(players, [penaltyMatch], "sum");
const p1Penalty = penaltyResult.rows.find((row) => row.playerId === "p1");
assert.ok(p1Penalty);
assert.equal(p1Penalty.raw.shots, 2);
assert.equal(p1Penalty.raw.goals, 2);
assert.ok(Math.abs(p1Penalty.raw.xg - 0.2) < 1e-9);
assert.ok(Math.abs(p1Penalty.values.xgPerShot - 0.2) < 1e-9);
assert.ok(Math.abs(p1Penalty.values.xgPerGoal - 0.2) < 1e-9);

const onPitchPlayers: Player[] = [
  { id: "op1", firstName: "A", lastName: "Starter", number: 1, position: "ST", teams: ["t1"] },
  { id: "op2", firstName: "B", lastName: "Sub", number: 2, position: "CM", teams: ["t1"] },
];

const onPitchMatch: TeamInfo = {
  matchId: "m-on-pitch",
  team: "t1",
  opponent: "opp",
  isHome: true,
  competition: "Liga",
  date: "2026-05-03",
  playerMinutes: [
    { playerId: "op1", startMinute: 0, endMinute: 90 },
    { playerId: "op2", startMinute: 0, endMinute: 45 },
  ],
  actions_packing: [],
  shots: [
    {
      id: "sa1",
      matchId: "m-on-pitch",
      teamId: "t1",
      teamContext: "attack",
      playerId: "op1",
      x: 50,
      y: 50,
      minute: 10,
      timestamp: 1,
      xG: 0.5,
      isGoal: false,
      shotType: "on_target",
    },
    {
      id: "sa2",
      matchId: "m-on-pitch",
      teamId: "t1",
      teamContext: "attack",
      playerId: "op1",
      x: 52,
      y: 52,
      minute: 60,
      timestamp: 2,
      xG: 0.3,
      isGoal: false,
      shotType: "off_target",
    },
    {
      id: "sd1",
      matchId: "m-on-pitch",
      teamId: "opp",
      teamContext: "defense",
      x: 20,
      y: 50,
      minute: 20,
      timestamp: 3,
      xG: 0.4,
      isGoal: false,
      shotType: "on_target",
    },
    {
      id: "sd2",
      matchId: "m-on-pitch",
      teamId: "opp",
      teamContext: "defense",
      x: 18,
      y: 48,
      minute: 70,
      timestamp: 4,
      xG: 0.2,
      isGoal: false,
      shotType: "off_target",
    },
  ],
  pkEntries: [
    {
      id: "pk-a",
      matchId: "m-on-pitch",
      teamId: "t1",
      teamContext: "attack",
      senderId: "op1",
      startX: 40,
      startY: 50,
      endX: 80,
      endY: 50,
      minute: 15,
      timestamp: 1,
      isSecondHalf: false,
      entryType: "pass",
    },
    {
      id: "pk-d",
      matchId: "m-on-pitch",
      teamId: "opp",
      teamContext: "defense",
      startX: 60,
      startY: 50,
      endX: 20,
      endY: 50,
      minute: 55,
      timestamp: 2,
      isSecondHalf: false,
      entryType: "dribble",
    },
  ],
  actions_regain: [],
  actions_loses: [],
};

const onPitchResult = buildPlayerComparisonRows(onPitchPlayers, [onPitchMatch], "sum");
const op1 = onPitchResult.rows.find((row) => row.playerId === "op1");
const op2 = onPitchResult.rows.find((row) => row.playerId === "op2");
assert.ok(op1 && op2);
assert.ok(Math.abs(op1.raw.xgOnPitchAttack - 0.8) < 1e-9);
assert.ok(Math.abs(op2.raw.xgOnPitchAttack - 0.5) < 1e-9);
assert.ok(Math.abs(op1.raw.xgOnPitchDefense - 0.6) < 1e-9);
assert.ok(Math.abs(op2.raw.xgOnPitchDefense - 0.4) < 1e-9);
assert.equal(op1.raw.pkEntriesOnPitchAttack, 1);
assert.equal(op2.raw.pkEntriesOnPitchAttack, 1);
assert.equal(op1.raw.pkEntriesOnPitchDefense, 1);
assert.equal(op2.raw.pkEntriesOnPitchDefense, 0);

console.log("playerComparisonMetrics tests: OK");
