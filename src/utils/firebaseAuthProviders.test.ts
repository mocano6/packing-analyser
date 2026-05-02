import assert from "node:assert/strict";
import type { User } from "firebase/auth";
import { userHasEmailPasswordProvider } from "./firebaseAuthProviders";

{
  assert.equal(userHasEmailPasswordProvider(null), false);
  assert.equal(userHasEmailPasswordProvider(undefined), false);
}

{
  const u = {
    providerData: [{ providerId: "google.com" }],
  } as unknown as User;
  assert.equal(userHasEmailPasswordProvider(u), false);
}

{
  const u = {
    providerData: [{ providerId: "google.com" }, { providerId: "password" }],
  } as unknown as User;
  assert.equal(userHasEmailPasswordProvider(u), true);
}

console.log("firebaseAuthProviders.test: OK");
