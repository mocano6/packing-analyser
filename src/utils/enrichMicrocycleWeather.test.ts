import assert from "assert";
import { createDefaultTrainingMicrocycleState } from "@/utils/trainingMicrocycle";
import {
  applyWeatherResultsToState,
  collectWeatherQueries,
  syncFixtureDetailsOntoMicrocycles,
} from "./enrichMicrocycleWeather";
import type { LaczyTeamFixture } from "@/types/trainingMicrocycle";

const base = createDefaultTrainingMicrocycleState(new Date("2026-08-03T12:00:00"));
const mcId = base.microcycles[0].id;

const withAddress = {
  ...base,
  microcycles: [
    {
      ...base.microcycles[0],
      weekStartIso: "2026-08-03",
      matches: [
        {
          ...base.microcycles[0].matches[0],
          dayIndex: 5,
          kickoffTime: "18:00",
          venueAddress: "Wołomińska 3, 05-250 Radzymin",
        },
      ],
    },
  ],
};

const queries = collectWeatherQueries(withAddress, new Date("2026-08-01T12:00:00"));
assert.equal(queries.length, 1);
assert.equal(queries[0].microcycleId, mcId);
assert.ok(queries[0].venueAddress.includes("Radzymin"));

const far = collectWeatherQueries(withAddress, new Date("2026-07-01T12:00:00"));
assert.equal(far.length, 0);

const applied = applyWeatherResultsToState(withAddress, [
  {
    id: `${mcId}:0`,
    ok: true,
    weatherCondition: "rain",
    weatherTempC: 14,
  },
]);
assert.equal(applied.microcycles[0].matches[0].weatherCondition, "rain");
assert.equal(applied.microcycles[0].matches[0].weatherTempC, 14);

const emptyAddress = {
  ...base,
  microcycles: [
    {
      ...base.microcycles[0],
      weekStartIso: "2026-08-03",
      matches: [
        {
          ...base.microcycles[0].matches[0],
          dayIndex: 5,
          venueAddress: "",
          opponent: "",
        },
      ],
    },
  ],
};
const fixture: LaczyTeamFixture = {
  matchId: "m1",
  dateTime: "2026-08-08T18:00:00",
  state: "Planowany",
  playId: "p1",
  playName: "Liga",
  hostId: "our",
  hostName: "My",
  guestId: "them",
  guestName: "Mazur",
  stadium: "Wołomińska 3, 05-250 Radzymin",
};
const synced = syncFixtureDetailsOntoMicrocycles(emptyAddress, [fixture], "our");
assert.ok(synced.microcycles[0].matches[0].venueAddress.includes("Radzymin"));
assert.equal(synced.microcycles[0].matches[0].opponent, "Mazur");

console.log("enrichMicrocycleWeather.test.ts: OK");
