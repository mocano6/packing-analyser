import assert from "node:assert/strict";
import { FirebaseError } from "firebase/app";
import { handleFirebaseError } from "./errorHandler";

const silent = { showNotification: false, silent: true } as const;

{
  const r = handleFirebaseError(
    new FirebaseError("auth/operation-not-allowed", "x"),
    "logowanie przez email",
    silent,
  );
  assert.ok(r.message.includes("Email/Password"));
}

{
  const r = handleFirebaseError(new FirebaseError("auth/invalid-api-key", "x"), "logowanie", silent);
  assert.ok(r.message.includes("NEXT_PUBLIC_FIREBASE_API_KEY"));
}

{
  const r = handleFirebaseError(new FirebaseError("auth/unknown-made-up", "x"), "logowanie", silent);
  assert.ok(r.message.includes("auth/unknown-made-up"));
}

console.log("errorHandler.authCodes.test: OK");
