import assert from "assert";
import {
  findWyscoutMatchByDate,
  normalizeWyscoutDateKey,
  sortWyscoutMatchesNewestFirst,
} from "./wyscoutMatchMatch";

assert.equal(normalizeWyscoutDateKey("2024-09-12"), "2024-09-12");
assert.equal(normalizeWyscoutDateKey("2024-09-12 18:00:00"), "2024-09-12");
assert.equal(normalizeWyscoutDateKey("12.09.2024"), "2024-09-12");
assert.equal(normalizeWyscoutDateKey("12/9/2024"), "2024-09-12");
assert.equal(normalizeWyscoutDateKey(""), null);
assert.equal(normalizeWyscoutDateKey("nie-data"), null);

const matches = [
  { matchId: 1, dateutc: "2024-08-01 16:00:00", date: "2024-08-01 18:00:00", label: "A" },
  { matchId: 2, dateutc: "2024-09-12 16:00:00", date: "2024-09-12 18:00:00", label: "B" },
];

assert.equal(findWyscoutMatchByDate(matches, "2024-09-12")?.matchId, 2);
assert.equal(findWyscoutMatchByDate(matches, "12.09.2024")?.matchId, 2);
assert.equal(findWyscoutMatchByDate(matches, "2023-01-01"), null);

const sorted = sortWyscoutMatchesNewestFirst(matches);
assert.equal(sorted[0]?.matchId, 2);

console.log("wyscoutMatchMatch.test.ts: OK");
