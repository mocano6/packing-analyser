import assert from "assert";
import { parseLaczyTeamIdFromUrl, buildLaczyTeamPageUrl, parseLaczyMatchIdFromUrl } from "./laczyTeamUrl";
import {
  applyFixtureToActiveMicrocycle,
  applyFixturesInWeekToMicrocycle,
  applyFixturesToExistingMicrocycles,
  buildMonthCalendarCells,
  fixtureCalendarChip,
  fixtureIsoDate,
  formatFixtureChipLabel,
  fixtureToMicrocycleMatch,
  fixturesInWeekByDay,
  groupFixturesByIsoDate,
  inferCompetitionFromPlayName,
  isIsoInWeek,
  isFixtureHomeForTeam,
  mergeLaczyFixtures,
  monthFromIso,
  removeMicrocycleFromState,
  setMicrocycleWeekAndApplyFixtures,
  shiftCalendarMonth,
  sortFixturesForDisplay,
  upsertMicrocyclesFromFixtures,
  weekStartIsoFromDateIso,
  weekStartIsoFromFixture,
  type LaczyTeamFixture,
} from "./microcycleFixtures";
import { createDefaultTrainingMicrocycleState, generateMicrocycleId } from "./trainingMicrocycle";

assert.equal(
  parseLaczyTeamIdFromUrl(
    "https://www.laczynaspilka.pl/rozgrywki/druzyna/4b125148-f622-4b9c-88f9-4a83fd8b7b3b?tab=tab-mecz"
  ),
  "4b125148-f622-4b9c-88f9-4a83fd8b7b3b"
);
assert.equal(parseLaczyTeamIdFromUrl("4b125148-f622-4b9c-88f9-4a83fd8b7b3b"), "4b125148-f622-4b9c-88f9-4a83fd8b7b3b");
assert.equal(parseLaczyTeamIdFromUrl("https://example.com/foo"), null);
assert.equal(
  parseLaczyTeamIdFromUrl(
    "https://www.laczynaspilka.pl/rozgrywki/mecz/2b77df3e-73c4-4961-bcd7-72b0e6174a1f"
  ),
  null
);
assert.equal(
  parseLaczyMatchIdFromUrl(
    "https://www.laczynaspilka.pl/rozgrywki/mecz/2b77df3e-73c4-4961-bcd7-72b0e6174a1f"
  ),
  "2b77df3e-73c4-4961-bcd7-72b0e6174a1f"
);
assert.ok(
  buildLaczyTeamPageUrl("4b125148-f622-4b9c-88f9-4a83fd8b7b3b").includes(
    "/druzyna/4b125148-f622-4b9c-88f9-4a83fd8b7b3b"
  )
);

assert.equal(inferCompetitionFromPlayName("Puchar Polski"), "cup");
assert.equal(inferCompetitionFromPlayName("Mecz towarzyski"), "friendly");
assert.equal(inferCompetitionFromPlayName("IV liga"), "league");

const fixture: LaczyTeamFixture = {
  matchId: "m1",
  dateTime: "2026-07-25T18:00:00", // sobota
  state: "Planowany",
  playId: "p1",
  playName: "Liga okręgowa",
  hostId: "our-team",
  hostName: "My",
  guestId: "opp",
  guestName: "Rywale FC",
  stadium: "Stadion X",
};

assert.equal(weekStartIsoFromFixture(fixture), "2026-07-20"); // pn
const match = fixtureToMicrocycleMatch(fixture, "our-team");
assert.equal(match.venue, "home");
assert.equal(match.opponent, "Rywale FC");
assert.equal(match.kickoffTime, "18:00");
assert.equal(match.dayIndex, 5); // sobota
assert.equal(match.venueAddress, "Stadion X");

const away = fixtureToMicrocycleMatch(
  { ...fixture, hostId: "opp", guestId: "our-team", hostName: "Rywale FC", guestName: "My" },
  "our-team"
);
assert.equal(away.venue, "away");
assert.equal(away.opponent, "Rywale FC");

{
  const state = createDefaultTrainingMicrocycleState(new Date("2026-07-13T12:00:00"));
  const seasonId = state.seasons[0].id;
  const secondId = generateMicrocycleId();
  state.microcycles.push({
    id: secondId,
    seasonId,
    number: 2,
    weekStartIso: "2026-07-20",
    matches: [fixtureToMicrocycleMatch(fixture, "our-team")],
    daySchedules: [],
  });
  state.assignments.push({
    id: "a1",
    microcycleId: secondId,
    dayIndex: 0,
    templateId: "t1",
    title: "Pressing",
    level: 0,
  });
  state.trainingCounts = { t1: 2 };
  state.activeMicrocycleId = secondId;

  const next = removeMicrocycleFromState(state, secondId);
  assert.equal(next.microcycles.length, 1);
  assert.equal(next.assignments.length, 0);
  assert.equal(next.trainingCounts.t1, 1);
  assert.equal(next.activeMicrocycleId, state.microcycles[0].id);
}

{
  // Po usunięciu mikrocyklu 1 pozostały z numerem 2 dostaje 1
  const state = createDefaultTrainingMicrocycleState(new Date("2026-07-13T12:00:00"));
  const seasonId = state.seasons[0].id;
  const firstId = state.microcycles[0].id;
  const secondId = generateMicrocycleId();
  state.microcycles[0] = { ...state.microcycles[0], number: 1, weekStartIso: "2026-07-13" };
  state.microcycles.push({
    id: secondId,
    seasonId,
    number: 2,
    weekStartIso: "2026-07-20",
    matches: [fixtureToMicrocycleMatch(fixture, "our-team")],
    daySchedules: [],
  });
  state.activeMicrocycleId = firstId;
  const next = removeMicrocycleFromState(state, firstId);
  assert.equal(next.microcycles.length, 1);
  assert.equal(next.microcycles[0].id, secondId);
  assert.equal(next.microcycles[0].number, 1);
  assert.equal(next.activeMicrocycleId, secondId);
}

{
  const state = createDefaultTrainingMicrocycleState(new Date("2026-07-13T12:00:00"));
  const applied = applyFixtureToActiveMicrocycle(state, fixture, "our-team");
  const m = applied.microcycles.find((x) => x.id === applied.activeMicrocycleId)!;
  assert.equal(m.weekStartIso, "2026-07-20");
  assert.equal(m.matches[0].opponent, "Rywale FC");
}

{
  const state = createDefaultTrainingMicrocycleState(new Date("2026-07-13T12:00:00"));
  const seasonId = state.seasons[0].id;
  const f2: LaczyTeamFixture = {
    ...fixture,
    matchId: "m2",
    dateTime: "2026-08-01T17:00:00",
    guestName: "Inny rywal",
  };
  const next = upsertMicrocyclesFromFixtures(state, seasonId, "our-team", [fixture, f2]);
  const inSeason = next.microcycles.filter((m) => m.seasonId === seasonId);
  assert.ok(inSeason.length >= 2);
  assert.ok(inSeason.some((m) => m.weekStartIso === "2026-07-20"));
  assert.ok(inSeason.some((m) => m.weekStartIso === "2026-07-27"));
}

{
  const past: LaczyTeamFixture = { ...fixture, matchId: "past", dateTime: "2026-01-10T12:00:00" };
  const future: LaczyTeamFixture = { ...fixture, matchId: "fut", dateTime: "2026-12-10T12:00:00" };
  const sorted = sortFixturesForDisplay([past, future], new Date("2026-07-01T00:00:00"));
  assert.equal(sorted[0].matchId, "fut");
  assert.equal(sorted[1].matchId, "past");
}

{
  const now = new Date("2026-07-01T12:00:00");
  const pastOld: LaczyTeamFixture = {
    ...fixture,
    matchId: "past1",
    dateTime: "2026-05-01T15:00:00",
    guestName: "Stary wynik 1:0",
    scoreFinal: "1:0",
  };
  const futureOld: LaczyTeamFixture = {
    ...fixture,
    matchId: "fut1",
    dateTime: "2026-09-01T18:00:00",
    guestName: "Stary przeciwnik",
  };
  const pastFromApiChanged: LaczyTeamFixture = {
    ...pastOld,
    guestName: "NIE nadpisuj",
    scoreFinal: "9:9",
  };
  const futureFromApi: LaczyTeamFixture = {
    ...futureOld,
    guestName: "Nowy przeciwnik",
  };
  const brandNewPast: LaczyTeamFixture = {
    ...fixture,
    matchId: "past2",
    dateTime: "2026-04-01T12:00:00",
    guestName: "Nowy historyczny",
  };
  const merged = mergeLaczyFixtures(
    [pastOld, futureOld],
    [pastFromApiChanged, futureFromApi, brandNewPast],
    now
  );
  assert.equal(merged.find((m) => m.matchId === "past1")?.scoreFinal, "1:0", "przeszły bez zmian");
  assert.equal(merged.find((m) => m.matchId === "past1")?.guestName, "Stary wynik 1:0");
  assert.equal(merged.find((m) => m.matchId === "fut1")?.guestName, "Nowy przeciwnik");
  assert.ok(merged.some((m) => m.matchId === "past2"), "nowy przeszły dodany raz");
}

{
  // Pierwsze pobranie — bierz wszystko
  const now = new Date("2026-07-01T12:00:00");
  const all = mergeLaczyFixtures(
    [],
    [
      { ...fixture, matchId: "a", dateTime: "2026-01-01T12:00:00" },
      { ...fixture, matchId: "b", dateTime: "2026-12-01T12:00:00" },
    ],
    now
  );
  assert.equal(all.length, 2);
}

{
  // sob. 08.08.2026 → tydzień od pn 03.08 → dayIndex 5
  const watch: LaczyTeamFixture = {
    ...fixture,
    matchId: "watch-sat",
    dateTime: "2026-08-08T15:00:00",
    hostId: "other",
    hostName: "Inna drużyna",
    guestId: "opp",
    guestName: "Rywal",
  };
  const hits = fixturesInWeekByDay([watch], "2026-08-03");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].dayIndex, 5);
  assert.equal(hits[0].fixture.matchId, "watch-sat");
  assert.equal(fixturesInWeekByDay([watch], "2026-08-10").length, 0);
}

{
  assert.equal(fixtureIsoDate(fixture), "2026-07-25");
  assert.equal(isFixtureHomeForTeam(fixture, "our-team"), true);
  assert.equal(formatFixtureChipLabel(fixture, "our-team"), "Dom 18:00 Rywale FC");
  const homeChip = fixtureCalendarChip(fixture, "our-team");
  assert.equal(homeChip.isHome, true);
  assert.equal(homeChip.venueShort, "D");
  assert.equal(homeChip.venueLabel, "Dom");
  const awayChip = formatFixtureChipLabel(
    { ...fixture, hostId: "opp", guestId: "our-team", hostName: "Rywale FC", guestName: "My" },
    "our-team"
  );
  assert.equal(awayChip, "Wyjazd 18:00 Rywale FC");
  const awayInfo = fixtureCalendarChip(
    { ...fixture, hostId: "opp", guestId: "our-team", hostName: "Rywale FC", guestName: "My" },
    "our-team"
  );
  assert.equal(awayInfo.isHome, false);
  assert.equal(awayInfo.venueShort, "W");
  const byDay = groupFixturesByIsoDate([fixture, { ...fixture, matchId: "m2", dateTime: "2026-07-25T12:00:00" }]);
  assert.equal(byDay.get("2026-07-25")?.length, 2);
  assert.equal(weekStartIsoFromDateIso("2026-07-25"), "2026-07-20");
  assert.equal(isIsoInWeek("2026-07-25", "2026-07-20"), true);
  assert.equal(isIsoInWeek("2026-07-19", "2026-07-20"), false);
  assert.deepEqual(monthFromIso("2026-08-19"), { year: 2026, monthIndex: 7 });
  assert.deepEqual(shiftCalendarMonth(2026, 0, -1), { year: 2025, monthIndex: 11 });
}

{
  // sierpień 2026: 1. to sobota → siatka od pn 27.07 do nd 06.09
  const cells = buildMonthCalendarCells(2026, 7);
  assert.equal(cells[0].iso, "2026-07-27");
  assert.equal(cells[0].inMonth, false);
  assert.equal(cells[0].weekdayIndex, 0);
  const aug1 = cells.find((c) => c.iso === "2026-08-01");
  assert.ok(aug1);
  assert.equal(aug1?.inMonth, true);
  assert.equal(aug1?.weekdayIndex, 5);
  assert.equal(cells[cells.length - 1].iso, "2026-09-06");
  assert.equal(cells.length % 7, 0);
}

{
  const state = createDefaultTrainingMicrocycleState(new Date("2026-07-13T12:00:00"));
  const mc = state.microcycles[0];
  mc.weekStartIso = "2026-07-20";
  mc.matches = [
    {
      dayIndex: 5,
      kickoffTime: "18:00",
      opponent: "",
      venue: "home",
      departureTime: "",
      competition: "league",
      venueAddress: "",
      surface: null,
      weatherCondition: "rain",
      weatherTempC: 12,
    },
  ];
  const nextMc = applyFixturesInWeekToMicrocycle(mc, [fixture], "our-team");
  assert.equal(nextMc.matches[0].opponent, "Rywale FC");
  assert.equal(nextMc.matches[0].venueAddress, "Stadion X");
  assert.equal(nextMc.matches[0].weatherCondition, "rain", "pogoda z edycji zostaje");
  assert.equal(nextMc.matches[0].weatherTempC, 12);
  assert.equal(applyFixturesInWeekToMicrocycle(nextMc, [fixture], "our-team"), nextMc);
}

{
  const state = createDefaultTrainingMicrocycleState(new Date("2026-07-13T12:00:00"));
  state.microcycles[0] = { ...state.microcycles[0], weekStartIso: "2026-07-20" };
  const otherId = generateMicrocycleId();
  state.microcycles.push({
    id: otherId,
    seasonId: state.seasons[0].id,
    number: 2,
    weekStartIso: "2026-08-10",
    matches: [
      {
        dayIndex: 5,
        kickoffTime: "18:00",
        opponent: "",
        venue: "home",
        departureTime: "",
        competition: "league",
        venueAddress: "",
        surface: null,
        weatherCondition: null,
        weatherTempC: null,
      },
    ],
    daySchedules: [],
  });
  const next = applyFixturesToExistingMicrocycles(state, [fixture], "our-team");
  const week20 = next.microcycles.find((m) => m.weekStartIso === "2026-07-20");
  const week10 = next.microcycles.find((m) => m.weekStartIso === "2026-08-10");
  assert.equal(week20?.matches[0].opponent, "Rywale FC");
  assert.equal(week10?.matches[0].opponent, "", "inny tydzień bez zmian");
}

{
  const state = createDefaultTrainingMicrocycleState(new Date("2026-07-13T12:00:00"));
  const id = state.microcycles[0].id;
  const moved = setMicrocycleWeekAndApplyFixtures(
    state,
    id,
    "2026-07-20",
    [fixture],
    "our-team"
  );
  const mc = moved.microcycles[0];
  assert.equal(mc.weekStartIso, "2026-07-20");
  assert.equal(mc.matches[0].opponent, "Rywale FC");
  assert.equal(mc.matches[0].dayIndex, 5);
}

console.log("laczyTeamUrl + microcycleFixtures tests: OK");
