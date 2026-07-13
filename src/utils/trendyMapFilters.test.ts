import assert from "node:assert/strict";
import {
  buildRegainsOppHalfHeatmap,
  collectMapPkEntriesFromMatches,
  collectMapShotsFromMatches,
  filterShotsByMapSide,
  collectTeamAttackPkEntriesFromMatches,
  collectTeamAttackShotsFromMatches,
  countRegainsOppHalfFromMatches,
  getPkEntryMapSide,
  getShotMapSide,
  getShotXgForMapFilter,
  shotMatchesTrendyXgRange,
} from "./trendyMapFilters";
import { Action, PKEntry, Shot, TeamInfo } from "@/types";

function makeMatch(overrides: Partial<TeamInfo> = {}): TeamInfo {
  return {
    matchId: "m1",
    team: "team-a",
    opponent: "team-b",
    date: "2025-01-01",
    shots: [],
    pkEntries: [],
    ...overrides,
  } as TeamInfo;
}

function makeShot(overrides: Partial<Shot> = {}): Shot {
  return {
    id: "s1",
    x: 80,
    y: 50,
    minute: 10,
    xG: 0.2,
    isGoal: false,
    shotType: "off_target",
    teamContext: "attack",
    teamId: "team-a",
    matchId: "m1",
    timestamp: 1,
    ...overrides,
  };
}

function makePkEntry(overrides: Partial<PKEntry> = {}): PKEntry {
  return {
    id: "pk1",
    matchId: "m1",
    teamId: "team-a",
    startX: 70,
    startY: 40,
    endX: 85,
    endY: 50,
    minute: 12,
    isSecondHalf: false,
    entryType: "pass",
    teamContext: "attack",
    timestamp: 1,
    ...overrides,
  };
}

(function testCollectTeamAttackShotsFromMatches() {
  const matches = [
    makeMatch({
      shots: [
        makeShot({ id: "a1", teamContext: "attack" }),
        makeShot({ id: "d1", teamContext: "defense" }),
      ],
    }),
    makeMatch({
      matchId: "m2",
      shots: [makeShot({ id: "a2", teamContext: "attack", matchId: "m2" })],
    }),
  ];

  const collected = collectTeamAttackShotsFromMatches(matches);
  assert.equal(collected.length, 2);
  assert.deepEqual(collected.map((s) => s.id), ["a1", "a2"]);
})();

(function testCollectTeamAttackPkEntriesFromMatches() {
  const matches = [
    makeMatch({
      pkEntries: [
        makePkEntry({ id: "pk-a", teamContext: "attack" }),
        makePkEntry({ id: "pk-d", teamContext: "defense" }),
      ],
    }),
  ];

  const collected = collectTeamAttackPkEntriesFromMatches(matches);
  assert.equal(collected.length, 1);
  assert.equal(collected[0].id, "pk-a");
})();

(function testCollectMapShotsIncludesOpponent() {
  const match = makeMatch({
    shots: [
      makeShot({ id: "a1", teamContext: "attack" }),
      makeShot({ id: "d1", teamContext: "defense" }),
      makeShot({ id: "d2", teamContext: undefined, teamId: "team-b" }),
    ],
  });

  assert.equal(getShotMapSide(match, match.shots![2]), "defense");

  const all = collectMapShotsFromMatches([match]);
  assert.equal(all.length, 3);

  const opponent = collectMapShotsFromMatches([match], "defense");
  assert.equal(opponent.length, 2);
  assert.deepEqual(opponent.map((s) => s.id).sort(), ["d1", "d2"]);
})();

(function testCollectMapPkEntriesIncludesOpponent() {
  const match = makeMatch({
    pkEntries: [
      makePkEntry({ id: "pk-a", teamContext: "attack" }),
      makePkEntry({ id: "pk-d", teamContext: "defense" }),
    ],
  });

  assert.equal(getPkEntryMapSide(match, match.pkEntries![1]), "defense");

  const opponent = collectMapPkEntriesFromMatches([match], "defense");
  assert.equal(opponent.length, 1);
  assert.equal(opponent[0].id, "pk-d");
  assert.equal(opponent[0].teamContext, "defense");
})();

(function testShotXgRangeHelpers() {
  const shots = [
    makeShot({ id: "low", xG: 0.05 }),
    makeShot({ id: "mid", xG: 0.35 }),
    makeShot({ id: "high", xG: 0.82 }),
  ];

  assert.equal(shotMatchesTrendyXgRange(shots[0], 0.1, 0.5), false);
  assert.equal(shotMatchesTrendyXgRange(shots[1], 0.1, 0.5), true);
  assert.equal(shotMatchesTrendyXgRange(shots[2], 0.1, 0.5), false);
  assert.equal(shotMatchesTrendyXgRange(shots[1], 0.5, 0.1), true);

  assert.equal(getShotXgForMapFilter(makeShot({ xG: undefined })), 0);
  assert.equal(shotMatchesTrendyXgRange(makeShot({ xG: 0.2 }), null, null), true);
})();

(function testRegainsOppHalfHeatmap() {
  const match: TeamInfo = {
    team: "team-a",
    opponent: "team-b",
    isHome: true,
    competition: "L",
    date: "2026-01-01",
    actions_regain: [
      {
        id: "r1",
        matchId: "m1",
        teamId: "team-a",
        minute: 10,
        senderId: "p1",
        actionType: "regain",
        isSecondHalf: false,
        regainAttackZone: "G10",
      } as Action,
      {
        id: "r2",
        matchId: "m1",
        teamId: "team-a",
        minute: 20,
        senderId: "p2",
        actionType: "regain",
        isSecondHalf: false,
        regainAttackZone: "D3",
      } as Action,
      {
        id: "r3",
        matchId: "m1",
        teamId: "team-b",
        minute: 30,
        senderId: "p9",
        actionType: "regain",
        isSecondHalf: false,
        regainAttackZone: "G11",
      } as Action,
    ],
  } as TeamInfo;

  assert.equal(countRegainsOppHalfFromMatches([match]), 1);
  const heatmap = buildRegainsOppHalfHeatmap([match]);
  assert.equal(heatmap.get("G10"), 1);
  assert.equal(heatmap.get("D3"), undefined);
})();

{
  const attack = makeShot({ id: "a", teamContext: "attack" });
  const defense = makeShot({ id: "d", teamContext: "defense" });
  const both = [attack, defense];
  assert.deepEqual(filterShotsByMapSide(both, "all").map((s) => s.id), ["a", "d"]);
  assert.deepEqual(filterShotsByMapSide(both, "attack").map((s) => s.id), ["a"]);
  assert.deepEqual(filterShotsByMapSide(both, "defense").map((s) => s.id), ["d"]);
}

console.log("trendyMapFilters.test.ts: OK");
