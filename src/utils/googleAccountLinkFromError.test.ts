import assert from "node:assert/strict";
import { FirebaseError } from "firebase/app";
import { readGoogleLinkDataFromAccountExistsError } from "./googleAccountLinkFromError";

{
  assert.equal(readGoogleLinkDataFromAccountExistsError(new Error("x")), null);
}

{
  assert.equal(
    readGoogleLinkDataFromAccountExistsError(new FirebaseError("auth/wrong-password", "x")),
    null,
  );
}

{
  const err = new FirebaseError("auth/account-exists-with-different-credential", "msg");
  const r = readGoogleLinkDataFromAccountExistsError(err);
  assert.equal(r, null);
}

console.log("googleAccountLinkFromError.test: OK");
