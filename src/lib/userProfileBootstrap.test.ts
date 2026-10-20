import assert from "node:assert/strict";
import {
  buildBootstrapUserProfile,
  buildPlayerRegistrationProfile,
  isPendingApprovalUser,
  shouldCreateDefaultUserProfile,
} from "./userProfileBootstrap";

{
  const now = new Date("2026-10-05T10:00:00.000Z");
  const profile = buildBootstrapUserProfile("nowy@example.com", now);
  assert.equal(profile.email, "nowy@example.com");
  assert.equal(profile.role, "player");
  assert.equal(profile.status, "pending");
  assert.equal(profile.linkedPlayerId, null);
  assert.deepEqual(profile.allowedTeams, []);
  assert.equal(profile.createdAt, now);
  assert.equal(profile.registrationData, undefined);
}

{
  const now = new Date("2026-10-05T10:00:00.000Z");
  const profile = buildPlayerRegistrationProfile({
    email: "zawodnik@example.com",
    firstName: "Jan",
    lastName: "Kowalski",
    birthYear: 2006,
    now,
  });
  assert.equal(profile.role, "player");
  assert.equal(profile.status, "pending");
  assert.deepEqual(profile.registrationData, {
    firstName: "Jan",
    lastName: "Kowalski",
    birthYear: 2006,
  });
}

{
  assert.equal(shouldCreateDefaultUserProfile(false), true);
  assert.equal(shouldCreateDefaultUserProfile(true), false);
}

{
  assert.equal(isPendingApprovalUser({ status: "pending" }), true);
  assert.equal(isPendingApprovalUser({ status: "approved" }), false);
  assert.equal(isPendingApprovalUser({ status: null }), false);
  assert.equal(isPendingApprovalUser({}), false);
}

console.log("userProfileBootstrap.test: OK");
