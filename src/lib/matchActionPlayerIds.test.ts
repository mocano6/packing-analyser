import assert from "assert";
import { getApps, initializeApp } from "firebase/app";
import { doc, getFirestore, type DocumentReference } from "firebase/firestore";
import { getActionReceiverIdFromRaw, getActionSenderIdFromRaw, normalizeFirestorePlayerId } from "./matchActionPlayerIds";

function testLegacyPlayerId() {
  assert.strictEqual(
    getActionSenderIdFromRaw({ senderId: "a1", receiverId: "b1" }),
    "a1",
  );
  assert.strictEqual(
    getActionSenderIdFromRaw({ playerId: "legacy", receiverId: "b1" }),
    "legacy",
  );
  assert.strictEqual(getActionSenderIdFromRaw({ player_id: "snake" }), "snake");
  assert.strictEqual(getActionReceiverIdFromRaw({ receiverPlayerId: "r1" }), "r1");
  assert.strictEqual(getActionReceiverIdFromRaw({ toPlayerId: "t1" }), "t1");
}

function testNumericLegacyIds() {
  assert.strictEqual(getActionSenderIdFromRaw({ playerId: 42 }), "42");
  assert.strictEqual(getActionReceiverIdFromRaw({ receiver_id: 7 }), "7");
}

function testPlayersPathString() {
  assert.strictEqual(normalizeFirestorePlayerId("players/abc123"), "abc123");
}

/** Prawdziwy DocumentReference (emulator nie jest wymagany — tylko ścieżka). */
function testDocumentReferenceId() {
  const name = "matchActionPlayerIds-test";
  const app =
    getApps().find((a) => a.name === name) ?? initializeApp({ projectId: "unit-test-match-action-ids" }, name);
  const db = getFirestore(app);
  const ref = doc(db, "players", "firestore-ref-id") as DocumentReference;
  assert.strictEqual(normalizeFirestorePlayerId(ref), "firestore-ref-id");
  assert.strictEqual(getActionSenderIdFromRaw({ senderId: ref, receiverId: "x" }), "firestore-ref-id");
}

testLegacyPlayerId();
testNumericLegacyIds();
testPlayersPathString();
testDocumentReferenceId();
console.log("matchActionPlayerIds tests: OK");
