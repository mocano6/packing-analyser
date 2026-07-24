import assert from "node:assert/strict";
import {
  STAFF_ROLE_OPTIONS,
  buildRoleChangePatch,
  canAccessKnowledgeBase,
  canAccessMatchVerification,
  isOperatorRoleFromFirestore,
  normalizeUserRole,
} from "./userRoles";

assert.equal(normalizeUserRole("operator"), "operator");
assert.equal(normalizeUserRole(" Operator "), "operator");
assert.equal(normalizeUserRole("ADMIN"), "admin");
assert.equal(normalizeUserRole("unknown"), "user");
assert.equal(normalizeUserRole(null), "user");
assert.equal(normalizeUserRole("analityk"), "user");
assert.equal(normalizeUserRole("analyst"), "user");

assert.equal(isOperatorRoleFromFirestore("operator"), true);
assert.equal(isOperatorRoleFromFirestore(" Operator "), true);
assert.equal(isOperatorRoleFromFirestore("admin"), false);
assert.equal(isOperatorRoleFromFirestore(undefined), false);

assert.equal(canAccessMatchVerification({ isAdmin: true, userRole: "user" }), true);
assert.equal(canAccessMatchVerification({ isAdmin: false, userRole: "operator" }), true);
assert.equal(canAccessMatchVerification({ isAdmin: false, userRole: "user" }), false);
assert.equal(canAccessMatchVerification({ isAdmin: false, userRole: "coach" }), false);

assert.equal(canAccessKnowledgeBase({ isAdmin: true, userRole: "player" }), true);
assert.equal(canAccessKnowledgeBase({ isAdmin: false, userRole: "operator" }), true);
assert.equal(canAccessKnowledgeBase({ isAdmin: false, userRole: "user" }), false);

assert.deepEqual(buildRoleChangePatch("player"), { role: "player" });
assert.deepEqual(buildRoleChangePatch("operator"), {
  role: "operator",
  status: "approved",
  linkedPlayerId: null,
});
assert.deepEqual(buildRoleChangePatch("user"), {
  role: "user",
  status: "approved",
  linkedPlayerId: null,
});
assert.ok(STAFF_ROLE_OPTIONS.every((option) => option.value !== "player"));
assert.ok(STAFF_ROLE_OPTIONS.some((option) => option.value === "operator"));
assert.ok(STAFF_ROLE_OPTIONS.some((option) => option.value === "user"));

console.log("userRoles tests: OK");
