import assert from "node:assert/strict";
import { isFirebasePermissionDenied } from "./isFirebasePermissionDenied";

assert.equal(isFirebasePermissionDenied(null), false);
assert.equal(isFirebasePermissionDenied({ code: "permission-denied" }), true);
assert.equal(
  isFirebasePermissionDenied({ message: "Missing or insufficient permissions." }),
  true
);
assert.equal(isFirebasePermissionDenied(new Error("permission-denied")), true);

console.log("isFirebasePermissionDenied.test: OK");
