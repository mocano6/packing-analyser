import assert from "assert";
import type { Action } from "@/types";
import { normalizePackingActionsInMatchDoc } from "./matchDocumentPackingNormalize";
import { accumulateMatchDocumentIntoGlobalCounts } from "./globalPlayerDataCounts";
import { createEmptyGlobalPlayerDataCounts } from "./globalPlayerDataCounts";

function testNormalizePackingMapsLegacyFields() {
  const raw = [
    {
      id: "x",
      playerId: "legacySender",
      receiverPlayerId: "legacyRecv",
      min: 12,
      type: "pass",
      packing: 2,
      startZone: "A",
      endZone: "B",
      isSecondHalf: false,
    },
  ] as unknown as Action[];

  const [a] = normalizePackingActionsInMatchDoc("m99", raw);
  assert.strictEqual(a.matchId, "m99");
  assert.strictEqual(a.minute, 12);
  assert.strictEqual(a.actionType, "pass");
  assert.strictEqual(a.packingPoints, 2);
  assert.strictEqual(a.senderId, "legacySender");
  assert.strictEqual(a.receiverId, "legacyRecv");
  assert.strictEqual(a.fromZone, "A");
  assert.strictEqual(a.toZone, "B");
}

function testNormalizedPackingCountsInGlobalMap() {
  const map = new Map<string, ReturnType<typeof createEmptyGlobalPlayerDataCounts>>();
  const normalized = normalizePackingActionsInMatchDoc("m1", [
    { id: "a", playerId: "p1", receiverPlayerId: "p2", isSecondHalf: false } as unknown as Action,
  ]);
  accumulateMatchDocumentIntoGlobalCounts(
    {
      actions_packing: normalized,
      actions_unpacking: [],
      actions_regain: [],
      actions_loses: [],
    } as Record<string, unknown>,
    map,
  );
  assert.strictEqual(map.get("p1")?.actionsPacking, 1);
  assert.strictEqual(map.get("p2")?.actionsPacking, 1);
}

testNormalizePackingMapsLegacyFields();
testNormalizedPackingCountsInGlobalMap();

console.log("matchDocumentCache tests: OK");
