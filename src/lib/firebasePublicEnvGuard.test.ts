import assert from "node:assert/strict";
import {
  FIREBASE_REQUIRED_PUBLIC_KEYS,
  type FirebasePublicEnvSnapshot,
  getFirebasePublicEnvPlaceholderKeys,
  getMissingFirebasePublicEnvKeys,
} from "./firebasePublicEnvGuard";

const fullPlaceholders: FirebasePublicEnvSnapshot = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "your_api_key_here",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "your_auth_domain_here",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "your_project_id_here",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "your_storage_bucket_here",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "your_messaging_sender_id_here",
  NEXT_PUBLIC_FIREBASE_APP_ID: "your_app_id_here",
};

assert.equal(getMissingFirebasePublicEnvKeys(fullPlaceholders).length, 0);
assert.equal(getFirebasePublicEnvPlaceholderKeys(fullPlaceholders).length, 6);

const empty: FirebasePublicEnvSnapshot = {
  NEXT_PUBLIC_FIREBASE_API_KEY: undefined,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: undefined,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: undefined,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: undefined,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: undefined,
  NEXT_PUBLIC_FIREBASE_APP_ID: undefined,
};
assert.deepEqual(getMissingFirebasePublicEnvKeys(empty), [...FIREBASE_REQUIRED_PUBLIC_KEYS]);

const mixed: FirebasePublicEnvSnapshot = {
  ...fullPlaceholders,
  NEXT_PUBLIC_FIREBASE_API_KEY: "AIza-real-key",
};
assert.deepEqual(getFirebasePublicEnvPlaceholderKeys(mixed), [
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
]);

console.log("firebasePublicEnvGuard.test: OK");
