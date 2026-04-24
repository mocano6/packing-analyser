import assert from "node:assert/strict";
import {
  isFirestoreOfflineLikeError,
  shouldQueuePendingOnMatchWriteFailure,
} from "./isFirestoreOfflineLikeError";

assert.equal(isFirestoreOfflineLikeError({ code: "permission-denied" }), false);
assert.equal(isFirestoreOfflineLikeError({ code: "unauthenticated" }), false);
assert.equal(isFirestoreOfflineLikeError(new Error("permission-denied")), false);

assert.equal(isFirestoreOfflineLikeError({ code: "unavailable" }), true);
assert.equal(isFirestoreOfflineLikeError({ code: "deadline-exceeded" }), false);
assert.equal(isFirestoreOfflineLikeError(new Error("Failed to fetch")), true);
assert.equal(isFirestoreOfflineLikeError(new Error("NetworkError when attempting to fetch")), true);

assert.equal(shouldQueuePendingOnMatchWriteFailure({ code: "permission-denied" }), false);
assert.equal(shouldQueuePendingOnMatchWriteFailure({ code: "deadline-exceeded" }), true);
assert.equal(shouldQueuePendingOnMatchWriteFailure({ code: "aborted" }), true);
assert.equal(shouldQueuePendingOnMatchWriteFailure(new Error("something weird")), true);
assert.equal(
  shouldQueuePendingOnMatchWriteFailure(new Error("MATCH_DOCUMENT_NOT_FOUND")),
  false,
);

console.log("isFirestoreOfflineLikeError tests: OK");
