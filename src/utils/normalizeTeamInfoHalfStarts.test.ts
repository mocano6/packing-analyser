import assert from "node:assert/strict";
import type { TeamInfo } from "@/types";
import { normalizeHalfStartTimeSeconds, normalizeTeamInfoHalfStarts } from "./normalizeTeamInfoHalfStarts";

const base: TeamInfo = {
  team: "t1",
  opponent: "o",
  isHome: true,
  competition: "L",
  date: "2026-01-01",
};

assert.equal(normalizeHalfStartTimeSeconds(undefined), undefined);
assert.equal(normalizeHalfStartTimeSeconds(null), undefined);
assert.equal(normalizeHalfStartTimeSeconds(0), undefined);
assert.equal(normalizeHalfStartTimeSeconds(-1), undefined);
assert.equal(normalizeHalfStartTimeSeconds(NaN), undefined);
assert.equal(normalizeHalfStartTimeSeconds("2767"), 2767);
assert.equal(normalizeHalfStartTimeSeconds(90.7), 90);

const stripped = normalizeTeamInfoHalfStarts({
  ...base,
  firstHalfStartTime: 0,
  secondHalfStartTime: 0,
});
assert.equal(stripped.firstHalfStartTime, undefined);
assert.equal(stripped.secondHalfStartTime, undefined);

const kept = normalizeTeamInfoHalfStarts({
  ...base,
  firstHalfStartTime: 120,
  secondHalfStartTime: 2800,
});
assert.equal(kept.firstHalfStartTime, 120);
assert.equal(kept.secondHalfStartTime, 2800);

console.log("normalizeTeamInfoHalfStarts tests: OK");
