import assert from "node:assert/strict";
import { FirebaseError } from "firebase/app";
import { authLoginErrorMessage } from "./authLoginErrorMessage";

{
  const msg = authLoginErrorMessage(new Error("Wprowadź email i hasło"));
  assert.equal(msg, "Wprowadź email i hasło");
}

{
  const msg = authLoginErrorMessage(new FirebaseError("auth/popup-closed-by-user", "x"));
  assert.ok(msg.includes("zamknięte"));
}

{
  const msg = authLoginErrorMessage(new FirebaseError("auth/popup-blocked", "x"));
  assert.ok(msg.includes("zablokowała"));
}

{
  const msg = authLoginErrorMessage(new FirebaseError("auth/account-exists-with-different-credential", "x"));
  assert.ok(msg.includes("Google"));
}

{
  const msg = authLoginErrorMessage(new FirebaseError("auth/operation-not-allowed", "x"));
  assert.ok(msg.includes("Sign-in method"));
}

{
  const msg = authLoginErrorMessage(new FirebaseError("auth/invalid-login-credentials", "x"));
  assert.ok(msg.includes("Google"));
}

console.log("authLoginErrorMessage.test: OK");
