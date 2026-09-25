import assert from "node:assert/strict";
import type { LaczyTeamFixture } from "@/types/trainingMicrocycle";
import type { LnpCachedMatchMinutes } from "@/types/lnpPlayerLoad";
import {
  aggregatePlayerLoadMinutes,
  DEFAULT_PLAYER_LOAD_SORT,
  effectivePlayerLoadMerges,
  fixturesMissingMinutes,
  isMatchInWindow,
  isPlayedFixtureWithData,
  loadBandForRow,
  LOAD_WINDOW_3D_MS,
  mergeCachedMatchMinutes,
  nextPlayerLoadSort,
  playedFixturesWithData,
  playerLoadMinutesButtonLabel,
  requestItemToCached,
  sortPlayerLoadRows,
  addPlayerLoadMerge,
  applyPlayerLoadRosterEdits,
  hidePlayerLoadKey,
  restorePlayerLoadKey,
  playerLoadMatchAppearances,
  playerLoadRowKey,
} from "./lnpPlayerLoad";

const now = new Date("2026-09-05T18:00:00");

function fixture(partial: Partial<LaczyTeamFixture> & { matchId: string; dateTime: string }): LaczyTeamFixture {
  return {
    state: "Rozegrany",
    playId: "p1",
    playName: "Liga",
    hostId: "our",
    hostName: "My",
    guestId: "opp",
    guestName: "Rywal",
    scoreFinal: "2:1",
    ...partial,
  };
}

assert.equal(
  isPlayedFixtureWithData(fixture({ matchId: "past", dateTime: "2026-09-01T17:00:00" }), now),
  true
);
assert.equal(
  isPlayedFixtureWithData(
    fixture({ matchId: "future", dateTime: "2026-09-10T17:00:00", state: "Planowany", scoreFinal: null }),
    now
  ),
  false
);
assert.equal(
  isPlayedFixtureWithData(
    fixture({
      matchId: "wo",
      dateTime: "2026-09-01T17:00:00",
      state: "Walkower",
      scoreFinal: "3:0",
    }),
    now
  ),
  false
);
assert.equal(
  isPlayedFixtureWithData(
    fixture({
      matchId: "plan-past",
      dateTime: "2026-09-01T17:00:00",
      state: "Planowany",
      scoreFinal: null,
    }),
    now
  ),
  true
);

const played = playedFixturesWithData(
  [
    fixture({ matchId: "a", dateTime: "2026-08-01T12:00:00" }),
    fixture({ matchId: "b", dateTime: "2026-09-02T12:00:00" }),
    fixture({
      matchId: "c",
      dateTime: "2026-09-20T12:00:00",
      state: "Planowany",
      scoreFinal: null,
    }),
  ],
  now
);
assert.deepEqual(
  played.map((f) => f.matchId),
  ["b", "a"]
);

const cached: LnpCachedMatchMinutes[] = [
  {
    matchId: "b",
    dateTime: "2026-09-02T12:00:00",
    opponent: "Rywal",
    isHome: true,
    playName: "Liga",
    scoreFinal: "1:0",
    fetchedAt: "2026-09-02T20:00:00.000Z",
    hasSquad: true,
    players: [
      { lnpId: "p1", firstName: "Jan", lastName: "Kowalski", number: 9, minutesPlayed: 90 },
    ],
  },
];
assert.deepEqual(
  fixturesMissingMinutes(
    [
      fixture({ matchId: "a", dateTime: "2026-08-01T12:00:00" }),
      fixture({ matchId: "b", dateTime: "2026-09-02T12:00:00" }),
    ],
    cached,
    now
  ).map((f) => f.matchId),
  ["a"]
);

assert.deepEqual(
  fixturesMissingMinutes(
    [fixture({ matchId: "b", dateTime: "2026-09-02T12:00:00" })],
    [{ ...cached[0], players: [] }],
    now
  ).map((f) => f.matchId),
  ["b"],
  "pusty skład w cache nie zamyka meczu"
);

const merged = mergeCachedMatchMinutes(cached, [
  {
    ...cached[0],
    matchId: "a",
    dateTime: "2026-08-01T12:00:00",
    scoreFinal: "0:0",
  },
]);
assert.deepEqual(
  merged.map((m) => m.matchId),
  ["b", "a"]
);

assert.equal(isMatchInWindow("2026-09-04T18:00:00", LOAD_WINDOW_3D_MS, now), true);
assert.equal(isMatchInWindow("2026-09-01T17:00:00", LOAD_WINDOW_3D_MS, now), false);
assert.equal(isMatchInWindow("2026-09-10T18:00:00", LOAD_WINDOW_3D_MS, now), false);

const rows = aggregatePlayerLoadMinutes(
  [
    {
      matchId: "m7",
      dateTime: "2026-08-20T17:00:00",
      opponent: "A",
      isHome: true,
      playName: "Liga",
      scoreFinal: "1:0",
      fetchedAt: "x",
      hasSquad: true,
      players: [
        { lnpId: "p1", firstName: "Jan", lastName: "Kowalski", number: 9, minutesPlayed: 90 },
        { lnpId: "p2", firstName: "Adam", lastName: "Nowak", number: 7, minutesPlayed: 45 },
        { lnpId: "p3", firstName: "Piotr", lastName: "Lis", number: 1, minutesPlayed: 0 },
      ],
    },
    {
      matchId: "m3",
      dateTime: "2026-09-04T17:00:00",
      opponent: "B",
      isHome: false,
      playName: "Liga",
      scoreFinal: "2:2",
      fetchedAt: "x",
      hasSquad: true,
      players: [
        { lnpId: "p1", firstName: "Jan", lastName: "Kowalski", number: 9, minutesPlayed: 70 },
        { lnpId: "p2", firstName: "Adam", lastName: "Nowak", number: 7, minutesPlayed: 90 },
      ],
    },
    {
      matchId: "empty",
      dateTime: "2026-09-03T17:00:00",
      opponent: "C",
      isHome: true,
      playName: "Puchar",
      scoreFinal: null,
      fetchedAt: "x",
      hasSquad: false,
      players: [{ lnpId: "p1", firstName: "Jan", lastName: "Kowalski", number: 9, minutesPlayed: 90 }],
    },
  ],
  now
);

assert.equal(rows.length, 2);
const jan = rows.find((r) => r.lnpId === "p1");
const adam = rows.find((r) => r.lnpId === "p2");
assert.ok(jan && adam);
assert.equal(jan.totalMinutes, 160);
assert.equal(jan.last7Days, 70);
assert.equal(jan.last3Days, 70);
assert.equal(jan.matchesPlayed, 2);
assert.equal(adam.totalMinutes, 135);
assert.equal(adam.last7Days, 90);
assert.equal(adam.last3Days, 90);
// Sortowanie: wyższe 7 dni pierwsze
assert.equal(rows[0].lnpId, "p2");

assert.equal(loadBandForRow({ last3Days: 90, last7Days: 90 }), "high");
assert.equal(loadBandForRow({ last3Days: 20, last7Days: 180 }), "high");
assert.equal(loadBandForRow({ last3Days: 50, last7Days: 50 }), "watch");
assert.equal(loadBandForRow({ last3Days: 10, last7Days: 20 }), "ok");

const mixedSource = aggregatePlayerLoadMinutes(
  [
    {
      matchId: "lnp-1",
      dateTime: "2026-09-04T17:00:00",
      opponent: "A",
      isHome: true,
      playName: "Liga",
      scoreFinal: "1:0",
      fetchedAt: "x",
      hasSquad: true,
      players: [{ lnpId: "p1", firstName: "Dawid", lastName: "Duczman", number: 2, minutesPlayed: 90 }],
    },
    {
      matchId: "pdf:2026-09-02:orly-vs-swit",
      dateTime: "2026-09-02T18:00:00",
      opponent: "Orły",
      isHome: false,
      playName: "Puchar",
      scoreFinal: "1:3",
      fetchedAt: "x",
      hasSquad: true,
      players: [{ lnpId: "", firstName: "DAWID", lastName: "DUCZMAN", number: 2, minutesPlayed: 90 }],
    },
  ],
  now
);
assert.equal(mixedSource.length, 2, "agregacja trzyma osobne klucze id vs name");
assert.equal(
  mixedSource.reduce((s, r) => s + r.totalMinutes, 0),
  180
);
const mixedCollapsed = applyPlayerLoadRosterEdits(mixedSource, [], []);
assert.equal(mixedCollapsed.length, 1, "to samo imię i nazwisko — jeden wiersz w tabeli");
assert.equal(mixedCollapsed[0].totalMinutes, 180);
assert.equal(mixedCollapsed[0].matchesPlayed, 2);
assert.equal(mixedCollapsed[0].lnpId, "p1");
assert.equal(mixedCollapsed[0].lastName, "Duczman");

const sameNameTwoIds = aggregatePlayerLoadMinutes(
  [
    {
      matchId: "a",
      dateTime: "2026-09-12T15:00:00",
      opponent: "Ząbkovia",
      isHome: true,
      playName: "Liga",
      scoreFinal: "1:0",
      fetchedAt: "x",
      hasSquad: true,
      players: [
        {
          lnpId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          firstName: "Jakub",
          lastName: "Rzepiński",
          number: 11,
          minutesPlayed: 45,
        },
      ],
    },
    {
      matchId: "b",
      dateTime: "2026-09-05T15:00:00",
      opponent: "Halinów",
      isHome: false,
      playName: "Liga",
      scoreFinal: "0:0",
      fetchedAt: "x",
      hasSquad: true,
      players: [
        { lnpId: "rzepinski-jakub-3", firstName: "Jakub", lastName: "Rzepiński", number: 11, minutesPlayed: 90 },
      ],
    },
  ],
  now
);
assert.equal(sameNameTwoIds.length, 2);
const rzep = applyPlayerLoadRosterEdits(sameNameTwoIds, [], []);
assert.equal(rzep.length, 1);
assert.equal(rzep[0].totalMinutes, 135);
assert.equal(rzep[0].matchesPlayed, 2);
assert.equal(rzep[0].lnpId, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");

const zpnAlias = aggregatePlayerLoadMinutes(
  [
    {
      matchId: "lnp-liga",
      dateTime: "2026-09-04T17:00:00",
      opponent: "A",
      isHome: true,
      playName: "Liga",
      scoreFinal: "1:0",
      fetchedAt: "x",
      hasSquad: true,
      players: [
        { lnpId: "p-pecz", firstName: "Mikołaj", lastName: "Pęczkowski", number: 9, minutesPlayed: 90 },
      ],
    },
    {
      matchId: "pdf:2026-09-02:puchar",
      dateTime: "2026-09-02T18:00:00",
      opponent: "Orły",
      isHome: false,
      playName: "Puchar",
      scoreFinal: "1:3",
      fetchedAt: "x",
      hasSquad: true,
      players: [{ lnpId: "", firstName: "MIKOŁAJ", lastName: "STEIGMANN", number: 9, minutesPlayed: 90 }],
    },
  ],
  now
);
assert.equal(zpnAlias.length, 2, "STEIGMANN i Pęczkowski zostają osobno bez ręcznego scalenia");
assert.equal(
  applyPlayerLoadRosterEdits(zpnAlias, [], []).length,
  2,
  "inne nazwiska — bez auto-scalenia"
);
const pecz = zpnAlias.find((r) => r.lastName === "Pęczkowski");
const steig = zpnAlias.find((r) => r.lastName === "STEIGMANN");
assert.ok(pecz && steig);
assert.equal(pecz.totalMinutes, 90);
assert.equal(steig.totalMinutes, 90);
const zpnMerged = applyPlayerLoadRosterEdits(zpnAlias, [], addPlayerLoadMerge([], steig.key, pecz.key));
assert.equal(zpnMerged.length, 1);
assert.equal(zpnMerged[0].totalMinutes, 180);
assert.equal(zpnMerged[0].matchesPlayed, 2);
assert.equal(zpnMerged[0].lnpId, "p-pecz");
assert.equal(zpnMerged[0].lastName, "Pęczkowski");
assert.equal(zpnMerged[0].number, 9);

const zpnAliasDifferentNumbers = aggregatePlayerLoadMinutes(
  [
    {
      matchId: "lnp-8",
      dateTime: "2026-09-05T17:00:00",
      opponent: "A",
      isHome: true,
      playName: "Liga",
      scoreFinal: "1:0",
      fetchedAt: "x",
      hasSquad: true,
      players: [
        { lnpId: "p-pecz", firstName: "Mikołaj", lastName: "Pęczkowski", number: 8, minutesPlayed: 67 },
      ],
    },
    {
      matchId: "lnp-9",
      dateTime: "2026-09-04T17:00:00",
      opponent: "B",
      isHome: true,
      playName: "Liga",
      scoreFinal: "1:0",
      fetchedAt: "x",
      hasSquad: true,
      players: [
        { lnpId: "p-pecz", firstName: "Mikołaj", lastName: "Pęczkowski", number: 9, minutesPlayed: 90 },
      ],
    },
    {
      matchId: "pdf:2026-09-02:puchar",
      dateTime: "2026-09-02T18:00:00",
      opponent: "Orły",
      isHome: false,
      playName: "Puchar",
      scoreFinal: "1:3",
      fetchedAt: "x",
      hasSquad: true,
      players: [{ lnpId: "", firstName: "MIKOŁAJ", lastName: "STEIGMANN", number: 9, minutesPlayed: 90 }],
    },
  ],
  now
);
assert.equal(zpnAliasDifferentNumbers.length, 2);
const peczMany = zpnAliasDifferentNumbers.find((r) => r.lnpId === "p-pecz");
const steigMany = zpnAliasDifferentNumbers.find((r) => r.lastName === "STEIGMANN");
assert.ok(peczMany && steigMany);
assert.equal(peczMany.matchesPlayed, 2);
const zpnMergedMany = applyPlayerLoadRosterEdits(
  zpnAliasDifferentNumbers,
  [],
  addPlayerLoadMerge([], steigMany.key, peczMany.key)
);
assert.equal(zpnMergedMany.length, 1);
assert.equal(zpnMergedMany[0].matchesPlayed, 3);
assert.equal(zpnMergedMany[0].lastName, "Pęczkowski");
assert.equal(zpnMergedMany[0].lnpId, "p-pecz");

const hiddenOne = applyPlayerLoadRosterEdits(zpnAlias, hidePlayerLoadKey([], steig.key), []);
assert.equal(hiddenOne.length, 1);
assert.equal(hiddenOne[0].lastName, "Pęczkowski");
const restored = applyPlayerLoadRosterEdits(zpnAlias, restorePlayerLoadKey(hidePlayerLoadKey([], steig.key), steig.key), []);
assert.equal(restored.length, 2);

const twoDifferentIds = aggregatePlayerLoadMinutes(
  [
    {
      matchId: "a",
      dateTime: "2026-09-04T17:00:00",
      opponent: "A",
      isHome: true,
      playName: "Liga",
      scoreFinal: "1:0",
      fetchedAt: "x",
      hasSquad: true,
      players: [{ lnpId: "id-1", firstName: "Jan", lastName: "Kowalski", number: 8, minutesPlayed: 90 }],
    },
    {
      matchId: "b",
      dateTime: "2026-09-02T18:00:00",
      opponent: "B",
      isHome: true,
      playName: "Liga",
      scoreFinal: "0:0",
      fetchedAt: "x",
      hasSquad: true,
      players: [{ lnpId: "id-2", firstName: "Jan", lastName: "Nowak", number: 8, minutesPlayed: 90 }],
    },
  ],
  now
);
assert.equal(twoDifferentIds.length, 2);
assert.equal(applyPlayerLoadRosterEdits(twoDifferentIds, [], []).length, 2);

assert.deepEqual(nextPlayerLoadSort(DEFAULT_PLAYER_LOAD_SORT, "matches"), {
  key: "matches",
  dir: "desc",
});
assert.deepEqual(nextPlayerLoadSort({ key: "matches", dir: "desc" }, "matches"), {
  key: "matches",
  dir: "asc",
});
assert.deepEqual(nextPlayerLoadSort({ key: "matches", dir: "desc" }, "name"), {
  key: "name",
  dir: "asc",
});

const sortSample = [
  {
    key: "a",
    lnpId: "a",
    firstName: "Adam",
    lastName: "Nowak",
    number: 7,
    totalMinutes: 100,
    last7Days: 40,
    last3Days: 10,
    matchesPlayed: 1,
    matchesLast7: 1,
    matchesLast3: 1,
  },
  {
    key: "b",
    lnpId: "b",
    firstName: "Jan",
    lastName: "Kowalski",
    number: 9,
    totalMinutes: 80,
    last7Days: 80,
    last3Days: 80,
    matchesPlayed: 3,
    matchesLast7: 2,
    matchesLast3: 1,
  },
];
assert.equal(sortPlayerLoadRows(sortSample, { key: "matches", dir: "desc" })[0].lnpId, "b");
assert.equal(sortPlayerLoadRows(sortSample, { key: "matches", dir: "asc" })[0].lnpId, "a");
assert.equal(sortPlayerLoadRows(sortSample, { key: "name", dir: "asc" })[0].lastName, "Kowalski");
assert.equal(sortPlayerLoadRows(sortSample, { key: "number", dir: "asc" })[0].number, 7);
assert.equal(sortPlayerLoadRows(sortSample, { key: "total", dir: "desc" })[0].lnpId, "a");
assert.equal(sortPlayerLoadRows(sortSample, { key: "last3", dir: "desc" })[0].lnpId, "b");

const events = {
  host: {
    name: "Nasza",
    squad: [
      {
        id: "h1",
        firstname: "Jan",
        lastname: "Kowalski",
        number: 9,
        type: "Starter",
        substitutions: [{ type: "Out", minute: "70'" }],
      },
      { id: "h2", firstname: "Piotr", lastname: "Lis", number: 1, type: "Substitute" },
    ],
  },
  guest: {
    name: "Rywal",
    squad: [
      {
        id: "g1",
        firstname: "Marek",
        lastname: "Bąk",
        number: 4,
        type: "Starter",
      },
    ],
  },
};

const home = requestItemToCached(
  {
    matchId: "m1",
    dateTime: "2026-09-01T17:00:00",
    isHome: true,
    opponent: "Rywal",
    playName: "Liga",
    scoreFinal: "1:0",
  },
  "our-team",
  events,
  "2026-09-01T20:00:00.000Z"
);
assert.equal(home.hasSquad, true);
assert.equal(home.isHome, true);
assert.equal(home.players.length, 1);
assert.equal(home.players[0].lastName, "Kowalski");
assert.equal(home.players[0].minutesPlayed, 70);

const away = requestItemToCached(
  {
    matchId: "m2",
    dateTime: "2026-09-02T17:00:00",
    isHome: false,
    opponent: "Nasza",
    hostId: "them",
    guestId: "our-team",
  },
  "our-team",
  events,
  "2026-09-02T20:00:00.000Z"
);
assert.equal(away.isHome, false);
assert.equal(away.players[0].lastName, "Bąk");
assert.equal(away.players[0].minutesPlayed, 90);

const empty = requestItemToCached(
  { matchId: "m3", dateTime: "2026-09-03T17:00:00", isHome: true },
  "our-team",
  { host: { squad: [] }, guest: { squad: [] } },
  "x"
);
assert.equal(empty.hasSquad, false);
assert.deepEqual(empty.players, []);

const appearanceMatches: LnpCachedMatchMinutes[] = [
  {
    matchId: "liga",
    dateTime: "2026-09-04T17:00:00",
    opponent: "Orły",
    isHome: true,
    playName: "Liga",
    scoreFinal: "2:1",
    fetchedAt: "x",
    hasSquad: true,
    players: [
      { lnpId: "dawid", firstName: "Dawid", lastName: "Duczman", number: 8, minutesPlayed: 90 },
      { lnpId: "inny", firstName: "Jan", lastName: "Kowalski", number: 9, minutesPlayed: 45 },
    ],
  },
  {
    matchId: "pdf:puchar",
    dateTime: "2026-08-20T18:00:00",
    opponent: "Wisła",
    isHome: false,
    playName: "Puchar",
    scoreFinal: "0:1",
    fetchedAt: "x",
    hasSquad: true,
    players: [{ lnpId: "", firstName: "DAWID", lastName: "DUCZMAN", number: 8, minutesPlayed: 70 }],
  },
  {
    matchId: "bench",
    dateTime: "2026-08-01T12:00:00",
    opponent: "Ławka",
    isHome: true,
    playName: "Liga",
    scoreFinal: "1:0",
    fetchedAt: "x",
    hasSquad: true,
    players: [{ lnpId: "dawid", firstName: "Dawid", lastName: "Duczman", number: 8, minutesPlayed: 0 }],
  },
];
const dawidKey = playerLoadRowKey({
  lnpId: "dawid",
  firstName: "Dawid",
  lastName: "Duczman",
  number: 8,
});
const dawidGames = playerLoadMatchAppearances(appearanceMatches, dawidKey);
assert.deepEqual(
  dawidGames.map((g) => [g.matchId, g.minutesPlayed, g.isHome, g.opponent]),
  [["liga", 90, true, "Orły"]]
);

const pdfKey = playerLoadRowKey({
  lnpId: "",
  firstName: "DAWID",
  lastName: "DUCZMAN",
  number: 8,
});
const mergedDawid = playerLoadMatchAppearances(
  appearanceMatches,
  dawidKey,
  effectivePlayerLoadMerges(
    [
      {
        key: dawidKey,
        lnpId: "dawid",
        firstName: "Dawid",
        lastName: "Duczman",
        number: 8,
        totalMinutes: 90,
        last7Days: 90,
        last3Days: 90,
        matchesPlayed: 1,
        matchesLast7: 1,
        matchesLast3: 1,
      },
      {
        key: pdfKey,
        lnpId: "",
        firstName: "DAWID",
        lastName: "DUCZMAN",
        number: 8,
        totalMinutes: 70,
        last7Days: 70,
        last3Days: 0,
        matchesPlayed: 1,
        matchesLast7: 1,
        matchesLast3: 0,
      },
    ],
    []
  )
);
assert.equal(mergedDawid.length, 2);
assert.equal(mergedDawid.find((g) => g.matchId === "pdf:puchar")?.minutesPlayed, 70);

assert.equal(
  playerLoadMinutesButtonLabel({ fetching: true, missingCount: 2, playedCount: 5 }),
  "Pobieram…"
);
assert.equal(
  playerLoadMinutesButtonLabel({ fetching: false, missingCount: 3, playedCount: 5, batch: 16 }),
  "Pobierz minuty (3)"
);
assert.equal(
  playerLoadMinutesButtonLabel({ fetching: false, missingCount: 0, playedCount: 5 }),
  "Sprawdź nowe mecze"
);
assert.equal(
  playerLoadMinutesButtonLabel({ fetching: false, missingCount: 0, playedCount: 0 }),
  "Pobierz minuty"
);

console.log("lnpPlayerLoad.test.ts: OK");
