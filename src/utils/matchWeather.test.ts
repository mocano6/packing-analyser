import assert from "assert";
import {
  applyWindOverride,
  geocodeQueryCandidates,
  isWithinForecastHorizon,
  kickoffIsoFromMicrocycleDay,
  pickHourlyIndex,
  wmoCodeToCondition,
} from "./matchWeather";

assert.equal(wmoCodeToCondition(0), "sunny");
assert.equal(wmoCodeToCondition(1), "sunny");
assert.equal(wmoCodeToCondition(3), "cloudy");
assert.equal(wmoCodeToCondition(61), "rain");
assert.equal(wmoCodeToCondition(95), "storm");
assert.equal(wmoCodeToCondition(73), "snow");

assert.equal(applyWindOverride("sunny", 45), "wind");
assert.equal(applyWindOverride("rain", 50), "rain");
assert.equal(applyWindOverride("cloudy", 20), "cloudy");

const kickoff = kickoffIsoFromMicrocycleDay("2026-08-03", 5, "18:00");
assert.ok(kickoff);
assert.ok(kickoff!.includes("2026-08-08") || kickoff!.includes("2026-08-07")); // TZ

const now = new Date("2026-08-01T12:00:00.000Z");
assert.equal(isWithinForecastHorizon("2026-08-08T16:00:00.000Z", now), true);
assert.equal(isWithinForecastHorizon("2026-09-01T16:00:00.000Z", now), false);

const candidates = geocodeQueryCandidates("Wołomińska 3 , 05-250 Radzymin");
assert.ok(candidates.some((c) => c.includes("Radzymin")));
assert.ok(candidates[0].includes("Wołomińska"));

const idx = pickHourlyIndex(
  ["2026-08-08T16:00", "2026-08-08T17:00", "2026-08-08T18:00"],
  "2026-08-08T17:10:00.000Z"
);
assert.ok(idx >= 0 && idx <= 2);

console.log("matchWeather.test.ts: OK");
