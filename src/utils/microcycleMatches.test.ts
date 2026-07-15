import assert from "assert";
import {
  createDefaultMicrocycleMatch,
  matchDaysFromMatches,
  normalizeMicrocycleMatches,
  sanitizeMicrocycleMatch,
} from "./microcycleMatches";

const legacy = normalizeMicrocycleMatches(undefined, [5, 2]);
assert.equal(legacy.length, 2);
assert.equal(legacy[0].dayIndex, 2);
assert.equal(legacy[1].dayIndex, 5);

const parsed = normalizeMicrocycleMatches([
  {
    dayIndex: 6,
    kickoffTime: "20:30",
    opponent: "Legia",
    venue: "away",
    competition: "cup",
  },
]);
assert.equal(parsed[0].kickoffTime, "20:30");
assert.equal(parsed[0].competition, "cup");

const withAddress = sanitizeMicrocycleMatch({
  dayIndex: 0,
  venueAddress: "Stadion Miejski, ul. Piłkarska 1",
});
assert.ok(withAddress.venueAddress.includes("Stadion"));

assert.deepEqual(matchDaysFromMatches(parsed), [6]);

const badTime = sanitizeMicrocycleMatch({ dayIndex: 1, kickoffTime: "99:99" });
assert.equal(badTime.kickoffTime, "18:00");

console.log("microcycleMatches.test.ts: OK");
