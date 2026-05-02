import assert from "node:assert/strict";
import { passwordLoginBlockedByGoogleOnlyProvider } from "./passwordLoginHintFromSignInMethods";

{
  const hint = passwordLoginBlockedByGoogleOnlyProvider(["google.com"]);
  assert.ok(hint && hint.includes("Google"));
}

{
  assert.equal(passwordLoginBlockedByGoogleOnlyProvider(["password"]), null);
}

{
  assert.equal(passwordLoginBlockedByGoogleOnlyProvider(["google.com", "password"]), null);
}

{
  assert.equal(passwordLoginBlockedByGoogleOnlyProvider([]), null);
}

console.log("passwordLoginHintFromSignInMethods.test: OK");
