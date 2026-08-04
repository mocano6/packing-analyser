import assert from "assert";
import {
  createDefaultMicrocycleMatch,
  formatMatchSurfaceLabel,
  formatMatchWeatherLabel,
  matchDaysFromMatches,
  normalizeMicrocycleMatches,
  sanitizeMicrocycleMatch,
  sanitizeMicrocycleMatchSurface,
  sanitizeMicrocycleWeatherCondition,
  sanitizeMicrocycleWeatherTempC,
} from "./microcycleMatches";

const legacy = normalizeMicrocycleMatches(undefined, [5, 2]);
assert.equal(legacy.length, 2);
assert.equal(legacy[0].dayIndex, 2);
assert.equal(legacy[1].dayIndex, 5);
assert.equal(legacy[0].surface, null);
assert.equal(legacy[0].weatherCondition, null);
assert.equal(legacy[0].weatherTempC, null);

const parsed = normalizeMicrocycleMatches([
  {
    dayIndex: 6,
    kickoffTime: "20:30",
    opponent: "Legia",
    venue: "away",
    departureTime: "14:30",
    competition: "cup",
    surface: "artificial",
    weatherCondition: "rain",
    weatherTempC: 12,
  },
]);
assert.equal(parsed[0].kickoffTime, "20:30");
assert.equal(parsed[0].competition, "cup");
assert.equal(parsed[0].surface, "artificial");
assert.equal(parsed[0].weatherCondition, "rain");
assert.equal(parsed[0].weatherTempC, 12);
assert.equal(parsed[0].departureTime, "14:30");

// Dom → brak godziny wyjazdu nawet jeśli podana
const homeClearsDeparture = sanitizeMicrocycleMatch({
  dayIndex: 5,
  venue: "home",
  departureTime: "12:00",
});
assert.equal(homeClearsDeparture.departureTime, "");
assert.equal(createDefaultMicrocycleMatch(5).departureTime, "");

const withAddress = sanitizeMicrocycleMatch({
  dayIndex: 0,
  venueAddress: "Stadion Miejski, ul. Piłkarska 1",
});
assert.ok(withAddress.venueAddress.includes("Stadion"));
assert.equal(withAddress.surface, null);

assert.deepEqual(matchDaysFromMatches(parsed), [6]);

const badTime = sanitizeMicrocycleMatch({ dayIndex: 1, kickoffTime: "99:99" });
assert.equal(badTime.kickoffTime, "18:00");

assert.equal(sanitizeMicrocycleMatchSurface("hybrid"), "hybrid");
assert.equal(sanitizeMicrocycleMatchSurface("sand"), null);
assert.equal(sanitizeMicrocycleWeatherCondition("storm"), "storm");
assert.equal(sanitizeMicrocycleWeatherCondition("fog"), null);
assert.equal(sanitizeMicrocycleWeatherTempC(18.4), 18);
assert.equal(sanitizeMicrocycleWeatherTempC(99), null);
assert.equal(sanitizeMicrocycleWeatherTempC(""), null);

const def = createDefaultMicrocycleMatch(5);
assert.equal(formatMatchSurfaceLabel(def.surface), "—");
assert.equal(formatMatchWeatherLabel(def), "—");
assert.equal(
  formatMatchWeatherLabel({
    ...def,
    weatherCondition: "sunny",
    weatherTempC: 22,
  }),
  "Słonecznie · 22°C"
);

console.log("microcycleMatches.test.ts: OK");
