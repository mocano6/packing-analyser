import assert from "node:assert/strict";
import {
  authUserHasPasswordProvider,
  authUserIsManageable,
  formatAuthProviderLabels,
  mergeFirestoreUsersWithAuthUsers,
  type AdminAuthUserSummary,
} from "./adminAuthUserList";

{
  assert.equal(formatAuthProviderLabels(["google.com"]), "Google");
  assert.equal(formatAuthProviderLabels(["google.com", "password"]), "Google, Email/hasło");
}

{
  assert.equal(authUserHasPasswordProvider(["google.com"]), false);
  assert.equal(authUserHasPasswordProvider(["google.com", "password"]), true);
}

{
  const googleOnly: AdminAuthUserSummary = {
    uid: "g1",
    email: "google@example.com",
    providerIds: ["google.com"],
    creationTime: "2024-01-01T00:00:00.000Z",
    lastSignInTime: "2024-06-01T00:00:00.000Z",
    disabled: false,
  };
  assert.equal(authUserIsManageable(googleOnly), true);

  const disabled: AdminAuthUserSummary = { ...googleOnly, uid: "g2", disabled: true };
  assert.equal(authUserIsManageable(disabled), false);
}

{
  const firestoreUsers = [
    {
      id: "fs1",
      email: "admin@example.com",
      allowedTeams: ["team-a"],
      role: "admin" as const,
      createdAt: new Date("2023-01-01"),
      lastLogin: new Date("2024-01-01"),
    },
  ];

  const authUsers: AdminAuthUserSummary[] = [
    {
      uid: "fs1",
      email: "admin@example.com",
      providerIds: ["password"],
      creationTime: "2023-01-01T00:00:00.000Z",
      lastSignInTime: "2024-02-01T00:00:00.000Z",
      disabled: false,
    },
    {
      uid: "google1",
      email: "player@gmail.com",
      providerIds: ["google.com"],
      creationTime: "2024-03-01T00:00:00.000Z",
      lastSignInTime: "2024-05-01T00:00:00.000Z",
      disabled: false,
    },
  ];

  const merged = mergeFirestoreUsersWithAuthUsers(firestoreUsers, authUsers);
  assert.equal(merged.length, 2);

  const admin = merged.find((u) => u.id === "fs1");
  assert.ok(admin);
  assert.equal(admin!.hasFirestoreProfile, true);
  assert.deepEqual(admin!.authProviders, ["password"]);
  assert.equal(admin!.allowedTeams[0], "team-a");

  const googleUser = merged.find((u) => u.id === "google1");
  assert.ok(googleUser);
  assert.equal(googleUser!.hasFirestoreProfile, false);
  assert.equal(googleUser!.email, "player@gmail.com");
  assert.deepEqual(googleUser!.authProviders, ["google.com"]);
  assert.equal(googleUser!.role, "user");
}

console.log("adminAuthUserList.test: OK");
