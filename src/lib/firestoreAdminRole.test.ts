import assert from "node:assert/strict";
import { isAdminRoleFromFirestore } from "./firestoreAdminRole";

assert.equal(isAdminRoleFromFirestore(undefined), false);
assert.equal(isAdminRoleFromFirestore("admin"), true);
assert.equal(isAdminRoleFromFirestore(" Admin "), true);
assert.equal(isAdminRoleFromFirestore("coach"), false);
assert.equal(isAdminRoleFromFirestore("administrator"), false);

console.log("firestoreAdminRole tests: OK");
