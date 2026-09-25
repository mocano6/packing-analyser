import assert from "node:assert/strict";
import {
  harvestHasCompleteMatchLists,
  harvestHasMatchLists,
  isLaczyCompetitionApiUrl,
  parseHarvestedLaczyFixtures,
} from "./laczyFixturesHarvest";

const teamId = "6df2a284-20a7-460d-9412-3ac4a512684c";
const playId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const matchId = "11111111-2222-3333-4444-555555555555";

// Bieżący host SPA to pro2; stary pro musi nadal być rozpoznawany.
const API = "https://competition-api-pro2.laczynaspilka.pl/api/bus/competition/v1/";

assert.equal(isLaczyCompetitionApiUrl(`${API}teams/${teamId}`), true);
assert.equal(
  isLaczyCompetitionApiUrl(
    `https://competition-api-pro.laczynaspilka.pl/api/bus/competition/v1/teams/${teamId}`
  ),
  true
);
assert.equal(isLaczyCompetitionApiUrl("https://www.laczynaspilka.pl/rozgrywki"), false);

const hits = [
  {
    url: `${API}teams/${teamId}`,
    status: 200,
    // Realny kształt: nazwa siedzi w kopercie `team`.
    data: { season: "2026/2027", team: { id: teamId, name: "Świt" } },
  },
  {
    url: `${API}teams/${teamId}/play-dictionaries`,
    status: 200,
    data: [{ playId, name: "Klasa okręgowa", isCurrent: true }],
  },
  {
    url: `${API}teams/${teamId}/plays/${playId}/not-played-matches`,
    status: 200,
    data: [
      {
        matchId,
        dateTime: "2026-09-20T15:00:00",
        state: "NotPlayed",
        host: { id: teamId, name: "Świt" },
        guest: { id: "99999999-9999-9999-9999-999999999999", name: "Rywal" },
      },
    ],
  },
];

const parsed = parseHarvestedLaczyFixtures(teamId, hits);
assert.equal(parsed.teamName, "Świt");

// Starszy, płaski kształt nadal działa.
const flat = parseHarvestedLaczyFixtures(teamId, [
  { url: `${API}teams/${teamId}`, status: 200, data: { id: teamId, name: "Świt II" } },
]);
assert.equal(flat.teamName, "Świt II");
assert.equal(parsed.plays[0]?.name, "Klasa okręgowa");
assert.equal(parsed.fixtures.length, 1);
assert.equal(parsed.fixtures[0]?.guestName, "Rywal");
assert.equal(parsed.matchListStatusOk, true);
assert.equal(harvestHasMatchLists(hits, teamId), true);
assert.equal(harvestHasCompleteMatchLists(hits, teamId), false);
assert.equal(harvestHasMatchLists(hits.filter((h) => h.status !== 200), teamId), false);

const bothLists = parseHarvestedLaczyFixtures(teamId, [
  ...hits,
  {
    url: `${API}teams/${teamId}/plays/${playId}/played-matches`,
    status: 200,
    data: [
      {
        matchId,
        dateTime: "2026-09-13T15:00:00",
        state: "Played",
        scores: { final: "2:1" },
        host: { id: teamId, name: "Świt" },
        guest: { id: "99999999-9999-9999-9999-999999999999", name: "Rywal" },
      },
    ],
  },
]);
assert.equal(bothLists.fixtures.length, 1);
assert.equal(bothLists.fixtures[0]?.scoreFinal, "2:1", "rozegrany wygrywa z not-played");
assert.equal(
  harvestHasCompleteMatchLists(
    [
      ...hits,
      {
        url: `${API}teams/${teamId}/plays/${playId}/played-matches`,
        status: 200,
        data: [],
      },
    ],
    teamId
  ),
  true
);

const emptyLists = parseHarvestedLaczyFixtures(teamId, [
  {
    url: `${API}teams/${teamId}/plays/${playId}/played-matches`,
    status: 200,
    data: [],
  },
]);
assert.equal(emptyLists.fixtures.length, 0);
assert.equal(emptyLists.matchListStatusOk, true);

const wrappedPlayed = parseHarvestedLaczyFixtures(teamId, [
  {
    url: `${API}teams/${teamId}/plays/${playId}/played-matches`,
    status: 200,
    data: {
      data: [
        {
          matchId: "wrapped-played",
          dateTime: "2026-09-13T15:00:00",
          state: "Played",
          host: { id: teamId, name: "Świt" },
          guest: { id: "99999999-9999-9999-9999-999999999999", name: "Rywal" },
        },
      ],
    },
  },
]);
assert.equal(wrappedPlayed.fixtures.length, 1);
assert.equal(wrappedPlayed.fixtures[0]?.matchId, "wrapped-played");

console.log("laczyFixturesHarvest.test.ts OK");
