import assert from "assert";
import {
  FIREBASE_AUTH_PASSWORD_MIN_LENGTH,
  parseAdminSetPasswordBody,
} from "./adminSetPasswordPolicy";

{
  const r = parseAdminSetPasswordBody({ uid: "abc123", newPassword: "secret12" });
  assert.strictEqual(r.ok, true);
  if (r.ok) {
    assert.strictEqual(r.uid, "abc123");
    assert.strictEqual(r.newPassword, "secret12");
  }
}

{
  const r = parseAdminSetPasswordBody({ uid: "x", newPassword: "  abcdef  " });
  assert.strictEqual(r.ok, true);
  if (r.ok) {
    assert.strictEqual(r.newPassword, "abcdef");
  }
}

{
  const r = parseAdminSetPasswordBody({ uid: "x", newPassword: "12345" });
  assert.strictEqual(r.ok, false);
  if (!r.ok) {
    assert.strictEqual(r.status, 400);
    assert.ok(r.error.includes(String(FIREBASE_AUTH_PASSWORD_MIN_LENGTH)));
  }
}

assert.strictEqual(parseAdminSetPasswordBody({ newPassword: "abcdef" }).ok, false);
assert.strictEqual(parseAdminSetPasswordBody(null).ok, false);
assert.strictEqual(parseAdminSetPasswordBody("x").ok, false);

console.log("adminSetPasswordPolicy.test: OK");
