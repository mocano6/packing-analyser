import assert from "node:assert/strict";
import { buildRegainZonePostWindowStats, REGAIN_POST_WINDOW_SECS } from "./wiedzaRegainPostWindowByZone";
import { TeamInfo } from "../types";

assert.deepEqual([...REGAIN_POST_WINDOW_SECS], [8, 12, 20]);

const match: TeamInfo = {
  team: "t1",
  opponent: "op",
  isHome: true,
  competition: "L",
  date: "2026-01-01",
  matchData: {},
  actions_regain: [
    {
      id: "r1",
      matchId: "m",
      teamId: "t1",
      minute: 1,
      actionType: "regain",
      senderId: "p1",
      isSecondHalf: false,
      videoTimestampRaw: 100,
      regainAttackZone: "D6",
      playersBehindBall: 5,
      totalPlayersOnField: 11,
      opponentsBehindBall: 4,
      totalOpponentsOnField: 11,
    } as any,
  ],
  actions_packing: [
    {
      id: "pk1",
      matchId: "m",
      minute: 2,
      actionType: "pass",
      senderId: "p1",
      isSecondHalf: false,
      videoTimestampRaw: 105,
      xTValueStart: 0.1,
      xTValueEnd: 0.15,
      packingPoints: 2,
    } as any,
  ],
  pkEntries: [
    {
      id: "e1",
      matchId: "m",
      teamId: "t1",
      teamContext: "attack",
      minute: 2,
      timestamp: 1,
      videoTimestampRaw: 106,
      startX: 0,
      startY: 0,
      endX: 1,
      endY: 1,
      isSecondHalf: false,
    } as any,
  ],
  shots: [
    {
      id: "s1",
      matchId: "m",
      teamId: "t1",
      teamContext: "attack",
      minute: 3,
      x: 50,
      y: 50,
      xG: 0.2,
      isGoal: false,
      shotType: "on_target",
      videoTimestampRaw: 107,
    } as any,
  ],
};

const rows = buildRegainZonePostWindowStats([match]);
assert.equal(rows.length, 1);
assert.equal(rows[0].zone, "D6");
const w8 = rows[0].byWindow[8];
assert.equal(w8.eligibleRegains, 1);
assert.equal(w8.totalPk, 1);
assert.ok(Math.abs(w8.totalXg - 0.2) < 1e-9);
assert.ok(Math.abs(w8.totalPxt - 0.05 * 2) < 1e-9);
assert.ok(Math.abs(w8.totalXtDelta - 0.05) < 1e-9);
assert.equal(w8.totalPackingPoints, 2);

// Strata w oknie 8 s — brak eligible
const matchLose: TeamInfo = {
  ...match,
  actions_loses: [
    {
      id: "l1",
      matchId: "m",
      teamId: "t1",
      minute: 1,
      actionType: "lose",
      senderId: "p1",
      isSecondHalf: false,
      videoTimestampRaw: 104,
    } as any,
  ],
};
const rowsL = buildRegainZonePostWindowStats([matchLose]);
assert.equal(rowsL.length, 0);

console.log("wiedzaRegainPostWindowByZone tests: OK");
