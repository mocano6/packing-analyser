import assert from "node:assert/strict";
import {
  buildRegainsOppHalfHeatmap,
  collectMapPkEntriesFromMatches,
  collectMapShotsFromMatches,
  collectTeamAttackPkEntriesFromMatches,
  collectTeamAttackShotsFromMatches,
  countRegainsOppHalfFromMatches,
  DEFAULT_TRENDY_PK_MAP_FILTERS,
  DEFAULT_TRENDY_XG_MAP_FILTERS,
  filterPkEntriesForTrendyMap,
  filterShotsForTrendyMap,
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

(function testFilterShotsForTrendyMapGoalsOnly() {
  const shots = [
    makeShot({ id: "g", isGoal: true, shotType: "goal" }),
    makeShot({ id: "o", isGoal: false, shotType: "off_target" }),
  ];

  const filtered = filterShotsForTrendyMap(shots, {
    ...DEFAULT_TRENDY_XG_MAP_FILTERS,
    sfg: false,
    counter: false,
    regain: false,
    blocked: false,
    onTarget: false,
    goal: true,
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "g");
})();

(function testFilterShotsForTrendyMapXgRange() {
  const noTypeFilters = {
    ...DEFAULT_TRENDY_XG_MAP_FILTERS,
    sfg: false,
    counter: false,
    regain: false,
    goal: false,
    blocked: false,
    onTarget: false,
  };

  const shots = [
    makeShot({ id: "low", xG: 0.05 }),
    makeShot({ id: "mid", xG: 0.35 }),
    makeShot({ id: "high", xG: 0.82 }),
  ];

  assert.deepEqual(
    filterShotsForTrendyMap(shots, { ...noTypeFilters, xgMin: 0.1, xgMax: 0.5 }).map((s) => s.id),
    ["mid"],
  );

  assert.deepEqual(
    filterShotsForTrendyMap(shots, { ...noTypeFilters, xgMin: 0.5, xgMax: 0.1 }).map((s) => s.id),
    ["mid"],
  );

  assert.equal(getShotXgForMapFilter(makeShot({ xG: undefined })), 0);
  assert.equal(shotMatchesTrendyXgRange(makeShot({ xG: 0.2 }), null, null), true);
})();

(function testFilterShotsForTrendyMapCounter() {
  const shots = [
    makeShot({ id: "c", actionType: "counter" }),
    makeShot({ id: "o", actionType: "open_play" }),
  ];

  const filtered = filterShotsForTrendyMap(shots, {
    ...DEFAULT_TRENDY_XG_MAP_FILTERS,
    sfg: false,
    regain: false,
    goal: false,
    blocked: false,
    onTarget: false,
    counter: true,
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "c");
})();

(function testFilterPkEntriesForTrendyMap() {
  const entries = [
    makePkEntry({ id: "d", entryType: "dribble", isGoal: true }),
    makePkEntry({ id: "p", entryType: "pass", isGoal: false }),
  ];

  const byType = filterPkEntriesForTrendyMap(entries, {
    ...DEFAULT_TRENDY_PK_MAP_FILTERS,
    entryType: "dribble",
  });
  assert.equal(byType.length, 1);
  assert.equal(byType[0].id, "d");

  const goalsOnly = filterPkEntriesForTrendyMap(entries, {
    ...DEFAULT_TRENDY_PK_MAP_FILTERS,
    onlyGoal: true,
  });
  assert.equal(goalsOnly.length, 1);
  assert.equal(goalsOnly[0].id, "d");
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

console.log("trendyMapFilters.test.ts: OK");
