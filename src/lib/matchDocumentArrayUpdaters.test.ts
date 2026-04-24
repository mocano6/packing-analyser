import assert from "node:assert/strict";
import type { Acc8sEntry, Action, PKEntry, Shot, TeamInfo } from "../types";
import { packingActionMetrics } from "../utils/wiedzaPackingZoneFlow";
import {
  appendActionToArray,
  applyAcc8sBulkFlagsUpdate,
  applyPkRegainBulkUpdate,
  applyShotsActionTypeBulkUpdate,
  buildCrossMatchMoveNext,
  buildMovePackingUnpackingNext,
  removeActionById,
  replaceActionByIdInArray,
} from "./matchDocumentArrayUpdaters";

const action = (id: string, overrides: Partial<Action> = {}): Action =>
  ({
    id,
    matchId: "m1",
    teamId: "t1",
    minute: 1,
    actionType: "pass",
    senderId: "s1",
    isSecondHalf: false,
    xTValueStart: 0.1,
    xTValueEnd: 0.3,
    packingPoints: 2,
    ...overrides,
  }) as Action;

// —— Packing / PxT: zapisane pola muszą wystarczyć do packingActionMetrics (PxT = ΔxT × pkt)
{
  const a = action("a1", { xTValueStart: 0.05, xTValueEnd: 0.15, packingPoints: 3 });
  const m = packingActionMetrics(a);
  assert.ok(Math.abs(m.xtDelta - 0.1) < 1e-9);
  assert.equal(m.packPts, 3);
  assert.ok(Math.abs(m.pxt - 0.3) < 1e-9);
}

// —— Przeniesienie packing ↔ unpacking
{
  const data = {
    actions_packing: [action("x")],
    actions_unpacking: [action("y")],
  } as unknown as TeamInfo;
  const moved = action("x", { mode: "defense" });
  const { nextA, nextB } = buildMovePackingUnpackingNext(
    data,
    "actions_packing",
    "actions_unpacking",
    "x",
    moved
  );
  assert.equal(nextA.length, 0);
  assert.equal(nextB.length, 2);
  assert.ok(nextB.some((a) => a.id === "x"));
}

// —— Przeniesienie między meczami (para tablic)
{
  const { nextSource, nextTarget } = buildCrossMatchMoveNext(
    [action("z")],
    [action("w")],
    "z",
    action("z", { minute: 99 })
  );
  assert.equal(nextSource.length, 0);
  assert.equal(nextTarget.length, 2);
  assert.equal(nextTarget.find((a) => a.id === "z")?.minute, 99);
}

// —— Edycja w miejscu
{
  const cur = [action("u", { minute: 1 })];
  const next = replaceActionByIdInArray(cur, "u", action("u", { minute: 44 }));
  assert.equal(next.length, 1);
  assert.equal(next[0].minute, 44);
}
assert.deepEqual(replaceActionByIdInArray([action("a")], "missing", action("x")), [action("a")]);

// —— Append / delete (nowe akcje z zakładek)
{
  const added = appendActionToArray([action("a")], action("b"));
  assert.equal(added.length, 2);
  assert.equal(removeActionById(added, "a").length, 1);
  assert.equal(removeActionById(added, "a")[0].id, "b");
}

// —— PK modal weryfikacji
{
  const getKey = (e: PKEntry) => e.id;
  const entries: PKEntry[] = [
    {
      id: "pk1",
      matchId: "m",
      teamId: "t",
      startX: 0,
      startY: 0,
      endX: 1,
      endY: 1,
      minute: 1,
      isSecondHalf: false,
      timestamp: 1,
      isRegain: false,
    },
  ];
  const next = applyPkRegainBulkUpdate(
    entries,
    [{ entryKey: "pk1", isRegain: true, isShot: true, isGoal: false }],
    new Set(["pk1"]),
    getKey
  );
  assert.equal(next[0].isRegain, true);
  assert.equal(next[0].isShot, true);
  assert.equal(next[0].isGoal, false);
}

// —— Strzały / xG — bulk actionType
{
  const getKey = (s: Shot) => s.id;
  const shots: Shot[] = [
    {
      id: "s1",
      x: 50,
      y: 50,
      minute: 1,
      xG: 0.1,
      isGoal: false,
      shotType: "on_target",
      teamContext: "attack",
      teamId: "t",
      matchId: "m",
      timestamp: 1,
      actionType: "open_play",
    },
  ];
  const next = applyShotsActionTypeBulkUpdate(
    shots,
    [{ shotKey: "s1", actionType: "counter" }],
    new Set(["s1"]),
    getKey
  );
  assert.equal(next[0].actionType, "counter");
}

// —— 8s ACC — bulk flagi
{
  const rows: Acc8sEntry[] = [
    {
      id: "e1",
      matchId: "m",
      teamId: "t",
      minute: 1,
      isSecondHalf: false,
      teamContext: "attack",
      isShotUnder8s: false,
      isPKEntryUnder8s: false,
      passingPlayerIds: [],
      timestamp: 1,
    },
  ];
  const next = applyAcc8sBulkFlagsUpdate(rows, [
    { id: "e1", isShotUnder8s: true, isPKEntryUnder8s: true },
  ]);
  assert.equal(next[0].isShotUnder8s, true);
  assert.equal(next[0].isPKEntryUnder8s, true);
}

console.log("matchDocumentArrayUpdaters tests: OK");
