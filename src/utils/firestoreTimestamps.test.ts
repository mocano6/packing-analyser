import assert from "node:assert/strict";
import { Timestamp } from "firebase/firestore";
import { coerceFirestoreToDate, formatLastLoginPl } from "./firestoreTimestamps";

assert.equal(coerceFirestoreToDate(null), null);
assert.equal(coerceFirestoreToDate(undefined), null);

const ts = Timestamp.fromDate(new Date("2024-06-15T12:30:00.000Z"));
const fromTs = coerceFirestoreToDate(ts);
assert.ok(fromTs);
assert.equal(fromTs.toISOString(), "2024-06-15T12:30:00.000Z");

assert.deepEqual(
  coerceFirestoreToDate({ seconds: 1718456400, nanoseconds: 0 })?.toISOString(),
  new Date(1718456400 * 1000).toISOString()
);

assert.equal(formatLastLoginPl(null), "Nigdy");
assert.ok(formatLastLoginPl(ts).length > 0);
assert.equal(formatLastLoginPl({ invalid: true }), "Nigdy");

console.log("firestoreTimestamps tests: OK");
