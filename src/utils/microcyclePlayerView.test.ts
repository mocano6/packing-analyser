import assert from "assert";
import { createDefaultMicrocycleMatch } from "./microcycleMatches";
import {
  buildPlayerDayCard,
  formatPlayerDate,
  playerDayKindLabel,
} from "./microcyclePlayerView";

assert.equal(formatPlayerDate(new Date(2026, 7, 10)), "10.08");
assert.equal(playerDayKindLabel("rest"), "Wolne");
assert.equal(playerDayKindLabel("match"), "Mecz");
assert.equal(playerDayKindLabel("training"), "Trening");

const tue = buildPlayerDayCard({
  dayIndex: 1,
  date: new Date(2026, 7, 11),
  mdLabel: "MD-4",
  isRest: false,
  isMatchDay: false,
  startTime: "18:15",
  blocks: [
    { minutes: 28 },
    { minutes: 10 },
    { minutes: 22 },
    { minutes: 0 },
  ],
  matches: [],
});
assert.equal(tue.weekday, "Wt");
assert.equal(tue.dateLabel, "11.08");
assert.equal(tue.kind, "training");
assert.equal(tue.startTime, "18:15");
assert.equal(tue.endTime, "19:15");
assert.equal(tue.durationMinutes, 60);
assert.equal(tue.matches.length, 0);

const rest = buildPlayerDayCard({
  dayIndex: 4,
  date: new Date(2026, 7, 14),
  mdLabel: "MD-1",
  isRest: true,
  isMatchDay: false,
  startTime: "18:15",
  blocks: [{ minutes: 15 }],
  matches: [],
});
assert.equal(rest.kind, "rest");
assert.equal(rest.startTime, null);
assert.equal(rest.durationMinutes, 0);

const sat = buildPlayerDayCard({
  dayIndex: 5,
  date: new Date(2026, 7, 15),
  mdLabel: "MD",
  isRest: false,
  isMatchDay: true,
  startTime: "10:00",
  blocks: [{ minutes: 20 }],
  matches: [
    {
      ...createDefaultMicrocycleMatch(5),
      kickoffTime: "17:00",
      opponent: "  Mazur  ",
      venue: "away",
      departureTime: "14:30",
      venueAddress: "Stadion Miejski",
      weatherCondition: "rain",
      weatherTempC: 12,
      surface: "natural",
    },
  ],
});
assert.equal(sat.kind, "match");
assert.equal(sat.durationMinutes, 0);
assert.equal(sat.matches.length, 1);
assert.equal(sat.matches[0].opponent, "Mazur");
assert.equal(sat.matches[0].kickoffTime, "17:00");
assert.equal(sat.matches[0].venueLabel, "Wyjazd");
assert.equal(sat.matches[0].departureTime, "14:30");
assert.equal(sat.matches[0].address, "Stadion Miejski");
assert.ok(sat.matches[0].weather.includes("12°C"));
assert.ok(sat.matches[0].surface.length > 0);

console.log("microcyclePlayerView.test OK");
