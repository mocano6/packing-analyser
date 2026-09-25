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
  pickSecondMatchDay,
  setSecondMicrocycleMatch,
  updateMicrocycleMatchAt,
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

// Drugi mecz wcześniejszy w tygodniu nie zamienia Mecz 1 z Meczem 2
{
  const saturday = {
    ...createDefaultMicrocycleMatch(5),
    opponent: "Legia",
    kickoffTime: "20:30",
    venue: "away" as const,
  };
  const withSecond = setSecondMicrocycleMatch([saturday], 2);
  assert.equal(withSecond.length, 2);
  assert.equal(withSecond[0].opponent, "Legia");
  assert.equal(withSecond[0].dayIndex, 5);
  assert.equal(withSecond[1].dayIndex, 2);
  assert.deepEqual(matchDaysFromMatches(withSecond), [5, 2]);

  const loaded = normalizeMicrocycleMatches(withSecond);
  assert.equal(loaded[0].opponent, "Legia");
  assert.equal(loaded[0].dayIndex, 5);
  assert.equal(loaded[1].dayIndex, 2);

  const patched = updateMicrocycleMatchAt(withSecond, 1, { opponent: "Puchar" });
  assert.equal(patched[0].opponent, "Legia");
  assert.equal(patched[1].opponent, "Puchar");
  assert.equal(patched[0].dayIndex, 5);
}

assert.equal(pickSecondMatchDay(5), 2);
assert.equal(pickSecondMatchDay(2), 1);
assert.notEqual(pickSecondMatchDay(0), 0);

console.log("microcycleMatches.test.ts: OK");
