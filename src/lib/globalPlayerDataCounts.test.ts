import assert from "assert";
import type { Action } from "../types";
import {
  accumulateMatchDocumentIntoGlobalCounts,
  accumulateGpsCollectionDocsIntoGlobalCounts,
  buildDerivedActionBucketsByPlayerId,
  buildDerivedMatchEventParticipationsByPlayerId,
  bumpGlobalMapFromLegacyPackingDoc,
  coerceMatchDocumentForAggregation,
  createEmptyGlobalPlayerDataCounts,
  globalDataContactTotal,
  lookupGlobalPlayerDataCounts,
  mergeGlobalCountsWithDerivedActionBuckets,
  mergeNestedMatchArraysIntoRootForAggregation,
  principalMatchDataContactTotal,
} from "./globalPlayerDataCounts";

function testAccumulateMatchDoc() {
  const map = new Map<string, ReturnType<typeof createEmptyGlobalPlayerDataCounts>>();
  const matchData = {
    actions_packing: [
      { id: "a1", senderId: "p1", receiverId: "p2", minute: 1, defensePlayers: ["p3"] },
      { id: "a2", playerId: "p9", receiverId: "p2", minute: 2 },
    ],
    actions_unpacking: [],
    actions_regain: [{ id: "r1", senderId: "p2", minute: 2 }],
    actions_loses: [],
    shots: [
      {
        id: "s1",
        playerId: "p1",
        assistantId: "p2",
        blockingPlayers: ["p3"],
        linePlayers: ["p4"],
        minute: 1,
        xG: 0.1,
        isGoal: false,
        shotType: "on_target",
        teamContext: "attack",
        teamId: "t1",
        matchId: "m1",
        timestamp: 1,
      },
    ],
    pkEntries: [{ id: "pk1", senderId: "p1", receiverId: "p2", matchId: "m1", teamId: "t1", minute: 1, isSecondHalf: false, timestamp: 1 }],
    acc8sEntries: [
      { id: "ac1", matchId: "m1", teamId: "t1", minute: 1, isSecondHalf: false, teamContext: "attack", passingPlayerIds: ["p1", "p2"], timestamp: 1 },
    ],
    playerMinutes: [{ playerId: "p1", startMinute: 0, endMinute: 90 }],
    gpsData: [{ playerId: "p2", matchId: "m1", timestamp: 1 }],
    matchData: { playerStats: [{ playerId: "p3", minutes: 90 }] },
  } as Record<string, unknown>;

  accumulateMatchDocumentIntoGlobalCounts(matchData, map);

  const p1 = map.get("p1")!;
  assert.strictEqual(p1.actionsPacking, 1);
  assert.strictEqual(p1.matchEventsParticipated, 4);

  const p9 = map.get("p9")!;
  assert.strictEqual(p9.actionsPacking, 1);
  assert.strictEqual(p9.matchEventsParticipated, 1);
  assert.strictEqual(p1.shotsAsShooter, 1);
  assert.strictEqual(p1.pkAsSender, 1);
  assert.strictEqual(p1.acc8sParticipations, 1);
  assert.strictEqual(p1.playerMinutesRows, 1);
  assert.strictEqual(p1.playerMinutesPlayedSum, 90);

  const p2 = map.get("p2")!;
  assert.strictEqual(p2.actionsPacking, 2);
  assert.strictEqual(p2.actionsRegain, 1);
  assert.strictEqual(p2.shotsAsAssistant, 1);
  assert.strictEqual(p2.pkAsReceiver, 1);
  assert.strictEqual(p2.gpsRowsInMatchDoc, 1);
  assert.strictEqual(p2.matchEventsParticipated, 6);

  const p3 = map.get("p3")!;
  assert.strictEqual(p3.actionsAsDefense, 1);
  assert.strictEqual(p3.shotsBlocking, 1);
  assert.strictEqual(p3.matchStatsRows, 1);
  assert.strictEqual(p3.matchEventsParticipated, 2);

  const p4 = map.get("p4")!;
  assert.strictEqual(p4.shotsLine, 1);
  assert.strictEqual(p4.matchEventsParticipated, 1);

  assert.ok(globalDataContactTotal(p1) > 0);
}

function testGpsCollection() {
  const map = new Map<string, ReturnType<typeof createEmptyGlobalPlayerDataCounts>>();
  accumulateGpsCollectionDocsIntoGlobalCounts(
    [{ data: () => ({ playerId: "g1" }) }, { data: () => ({ playerId: "g1" }) }],
    map,
  );
  assert.strictEqual(map.get("g1")!.gpsCollectionDocs, 2);
}

function testNestedMergeLiftsShotsIntoRoot() {
  const raw = {
    shots: [],
    matchData: {
      shots: [
        {
          id: "s1",
          playerId: "nestedShooter",
          minute: 1,
          xG: 0.1,
          isGoal: false,
          shotType: "on_target",
          teamContext: "attack",
          teamId: "t1",
          matchId: "m1",
          timestamp: 1,
        },
      ],
    },
  } as Record<string, unknown>;
  const merged = mergeNestedMatchArraysIntoRootForAggregation(raw);
  assert.strictEqual(Array.isArray(merged.shots) && merged.shots.length, 1);
  const map = new Map<string, ReturnType<typeof createEmptyGlobalPlayerDataCounts>>();
  accumulateMatchDocumentIntoGlobalCounts(merged, map);
  assert.strictEqual(map.get("nestedShooter")!.shotsAsShooter, 1);
}

function testStringMatchDataJsonParsesBeforeMerge() {
  const raw = {
    actions_packing: [],
    matchData: JSON.stringify({
      actions_packing: [{ id: "a1", senderId: "jsonP", minute: 1 }],
    }),
  } as Record<string, unknown>;
  const merged = mergeNestedMatchArraysIntoRootForAggregation(raw);
  const map = new Map<string, ReturnType<typeof createEmptyGlobalPlayerDataCounts>>();
  accumulateMatchDocumentIntoGlobalCounts(merged, map);
  assert.strictEqual(map.get("jsonP")!.actionsPacking, 1);
  const coercedOnly = coerceMatchDocumentForAggregation({
    matchData: '{"actions_packing":[{"id":"x","senderId":"s","minute":1}]}',
  } as Record<string, unknown>);
  assert.ok(coercedOnly.matchData && typeof coercedOnly.matchData === "object");
}

function testDoubleNestedMatchDataLiftsActions() {
  const raw = {
    actions_regain: [],
    matchData: {
      matchData: {
        actions_regain: [{ id: "r1", senderId: "deepP", minute: 1 }],
      },
    },
  } as Record<string, unknown>;
  const merged = mergeNestedMatchArraysIntoRootForAggregation(raw);
  const map = new Map<string, ReturnType<typeof createEmptyGlobalPlayerDataCounts>>();
  accumulateMatchDocumentIntoGlobalCounts(merged, map);
  assert.strictEqual(map.get("deepP")!.actionsRegain, 1);
}

function testBumpLegacyPackingDoc() {
  const map = new Map<string, ReturnType<typeof createEmptyGlobalPlayerDataCounts>>();
  bumpGlobalMapFromLegacyPackingDoc(map, {
    senderId: "s1",
    receiverId: "r1",
    defensePlayers: ["d1"],
  } as Record<string, unknown>);
  assert.strictEqual(map.get("s1")!.actionsPacking, 1);
  assert.strictEqual(map.get("r1")!.actionsPacking, 1);
  assert.strictEqual(map.get("d1")!.actionsAsDefense, 1);
  assert.strictEqual(map.get("s1")!.matchEventsParticipated, 1);
  assert.strictEqual(map.get("r1")!.matchEventsParticipated, 1);
  assert.strictEqual(map.get("d1")!.matchEventsParticipated, 1);
}

function testPrincipalTotalMatchesFiveBucketsPlusShotsPk() {
  const c = createEmptyGlobalPlayerDataCounts();
  c.actionsPacking = 1;
  c.actionsUnpacking = 1;
  c.actionsRegain = 1;
  c.actionsLoses = 1;
  c.shotsAsShooter = 1;
  c.pkAsSender = 1;
  c.pkAsReceiver = 1;
  c.actionsAsDefense = 99;
  assert.strictEqual(principalMatchDataContactTotal(c), 7);
}

function testLookupGlobalCountsByAliasKey() {
  const record: Record<string, ReturnType<typeof createEmptyGlobalPlayerDataCounts>> = {};
  const c = createEmptyGlobalPlayerDataCounts();
  c.shotsAsShooter = 3;
  record["players/aliasPlayer"] = c;
  const got = lookupGlobalPlayerDataCounts(record, "aliasPlayer");
  assert.strictEqual(got.shotsAsShooter, 3);
}

function testMergeDerivedEventsOnlyRaisesTotal() {
  const base = createEmptyGlobalPlayerDataCounts();
  base.matchEventsParticipated = 1;
  const merged = mergeGlobalCountsWithDerivedActionBuckets(base, undefined, 5);
  assert.strictEqual(merged.matchEventsParticipated, 5);
}

function testBuildDerivedMatchEventsCountsDefenseOncePerRow() {
  const actions = [
    {
      id: "1",
      matchId: "m",
      senderId: "p1",
      receiverId: "p2",
      minute: 1,
      actionType: "pass",
      isSecondHalf: false,
      sourceMatchArray: "actions_packing",
      defensePlayers: ["p1", "p3"],
    },
  ] as Action[];
  const m = buildDerivedMatchEventParticipationsByPlayerId(actions);
  assert.strictEqual(m.get("p1"), 1);
  assert.strictEqual(m.get("p2"), 1);
  assert.strictEqual(m.get("p3"), 1);
}

function testBuildDerivedFromCollectedActions() {
  const actions = [
    {
      id: "1",
      matchId: "m",
      senderId: "p1",
      receiverId: "p2",
      minute: 1,
      actionType: "pass",
      isSecondHalf: false,
      sourceMatchArray: "actions_packing",
    },
    {
      id: "2",
      matchId: "m",
      senderId: "p1",
      receiverId: "p2",
      minute: 2,
      actionType: "pass",
      isSecondHalf: false,
      sourceMatchArray: "actions_regain",
    },
  ] as Action[];
  const m = buildDerivedActionBucketsByPlayerId(actions);
  assert.strictEqual(m.get("p1")?.actionsPacking, 1);
  assert.strictEqual(m.get("p1")?.actionsRegain, 1);
  assert.strictEqual(m.get("p2")?.actionsPacking, 1);
  assert.strictEqual(m.get("p2")?.actionsRegain, 1);
}

testAccumulateMatchDoc();
testGpsCollection();
testNestedMergeLiftsShotsIntoRoot();
testStringMatchDataJsonParsesBeforeMerge();
testDoubleNestedMatchDataLiftsActions();
testPrincipalTotalMatchesFiveBucketsPlusShotsPk();
testBumpLegacyPackingDoc();
testLookupGlobalCountsByAliasKey();
testMergeDerivedEventsOnlyRaisesTotal();
testBuildDerivedMatchEventsCountsDefenseOncePerRow();
testBuildDerivedFromCollectedActions();

console.log("globalPlayerDataCounts tests: OK");
