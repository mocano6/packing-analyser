import assert from "assert";
import { getApps, initializeApp } from "firebase/app";
import { doc as firestoreDoc, getFirestore } from "firebase/firestore";
import type { Action, Shot, PKEntry, Acc8sEntry, PlayerMinutes } from "@/types";
import {
  buildMatchDocumentUpdatesForDuplicateMerge,
  buildMatchDocumentUpdatesForDuplicateMergeMany,
  collectAllActionsFromMatchDoc,
} from "./duplicatePlayerMergeRewrite";

const dup = ["dup-a", "dup-b"];
const main = "main-x";

const baseAction = (id: string, sender: string, receiver?: string): Action =>
  ({
    id,
    matchId: "m1",
    teamId: "t1",
    minute: 1,
    senderId: sender,
    receiverId: receiver,
    actionType: "pass",
    isSecondHalf: false,
  }) as Action;

const doc: Record<string, unknown> = {
  actions_packing: [baseAction("1", "dup-a", "p2")],
  actions_regain: [
    {
      ...baseAction("2", "p2"),
      defensePlayers: ["dup-b", "p3"],
    } as Action,
  ],
  shots: [
    {
      id: "s1",
      playerId: "dup-a",
      assistantId: "dup-b",
      blockingPlayers: ["dup-a"],
      linePlayers: ["p9", "dup-a"],
      minute: 1,
      xG: 0.1,
      isGoal: false,
      matchId: "m1",
      timestamp: 1,
      shotType: "on_target",
      teamContext: "attack",
      teamId: "t1",
    } as Shot,
  ],
  pkEntries: [
    {
      id: "pk1",
      matchId: "m1",
      teamId: "t1",
      senderId: "dup-a",
      receiverId: "dup-b",
      minute: 1,
      isSecondHalf: false,
      startX: 0,
      startY: 0,
      endX: 1,
      endY: 1,
      timestamp: 1,
    } as PKEntry,
  ],
  acc8sEntries: [
    {
      id: "a1",
      matchId: "m1",
      teamId: "t1",
      minute: 1,
      isSecondHalf: false,
      teamContext: "attack",
      isShotUnder8s: false,
      isPKEntryUnder8s: false,
      passingPlayerIds: ["dup-a", "p1"],
      timestamp: 1,
    } as Acc8sEntry,
  ],
  playerMinutes: [
    { playerId: "dup-a", startMinute: 0, endMinute: 90 } as PlayerMinutes,
  ],
};

const { updates, changed } = buildMatchDocumentUpdatesForDuplicateMerge(doc, dup, main);
assert.equal(changed, true);
assert.ok(Array.isArray(updates.actions_packing));
assert.equal((updates.actions_packing as Action[])[0].senderId, main);
assert.equal((updates.actions_packing as Action[])[0].receiverId, "p2");

const reg = (updates.actions_regain as Action[])[0];
assert.deepEqual(reg.defensePlayers, [main, "p3"]);

const sh = (updates.shots as Shot[])[0];
assert.equal(sh.playerId, main);
assert.equal(sh.assistantId, main);
assert.deepEqual(sh.blockingPlayers, [main]);
assert.deepEqual(sh.linePlayers, ["p9", main]);

const pk = (updates.pkEntries as PKEntry[])[0];
assert.equal(pk.senderId, main);
assert.equal(pk.receiverId, main);

const acc = (updates.acc8sEntries as Acc8sEntry[])[0];
assert.deepEqual(acc.passingPlayerIds, [main, "p1"]);

const pm = (updates.playerMinutes as PlayerMinutes[])[0];
assert.equal(pm.playerId, main);

const all = collectAllActionsFromMatchDoc(doc, "mid");
assert.equal(all.length, 2);

const docTwoGroups: Record<string, unknown> = {
  actions_packing: [baseAction("1", "dup-a", "other-1")],
  actions_unpacking: [baseAction("2", "dup-b", "other-2")],
};
const many = buildMatchDocumentUpdatesForDuplicateMergeMany(docTwoGroups, [
  { duplicatePlayerIds: ["dup-a"], mainPlayerId: "main-x" },
  { duplicatePlayerIds: ["dup-b"], mainPlayerId: "main-y" },
]);
assert.equal(many.changed, true);
const packMany = many.updates.actions_packing as Action[];
const unpackMany = many.updates.actions_unpacking as Action[];
assert.equal(packMany[0].senderId, "main-x");
assert.equal(unpackMany[0].senderId, "main-y");

/** Akcja z senderId jako DocumentReference — musi zostać zmapowana na main (inaczej po soft-delete duplikatu znikają powiązania w UI). */
function testMergeWhenSenderIdIsDocumentReference() {
  const appName = "duplicatePlayerMergeRewrite-ref-test";
  const app =
    getApps().find((a) => a.name === appName) ?? initializeApp({ projectId: "dup-merge-ref-unit" }, appName);
  const db = getFirestore(app);
  const ref = firestoreDoc(db, "players", "dup-a");
  const docWithRef: Record<string, unknown> = {
    actions_packing: [
      {
        id: "1",
        matchId: "m1",
        teamId: "t1",
        minute: 1,
        senderId: ref,
        receiverId: "p2",
        actionType: "pass",
        isSecondHalf: false,
      },
    ],
  };
  const { updates, changed } = buildMatchDocumentUpdatesForDuplicateMerge(docWithRef, ["dup-a"], "main-x");
  assert.equal(changed, true);
  assert.equal((updates.actions_packing as Action[])[0].senderId, "main-x");
}

testMergeWhenSenderIdIsDocumentReference();

console.log("duplicatePlayerMergeRewrite tests: OK");
