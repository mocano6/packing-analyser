import type {
  LaczyTeamFixture,
  MicrocycleMatch,
  MicrocycleMatchCompetition,
  TrainingMicrocycle,
  TrainingMicrocycleState,
} from "@/types/trainingMicrocycle";
import { createDefaultMicrocycleMatch, sanitizeMicrocycleMatch } from "@/utils/microcycleMatches";
import {
  applyTrainingCountDelta,
  generateMicrocycleId,
  microcyclesForSeason,
  nextMicrocycleNumber,
  renumberSeasonMicrocycles,
} from "@/utils/trainingMicrocycle";
import { addDays, parseIsoDateLocal, startOfWeekMonday, toIsoDateLocal } from "@/utils/matchDayLabels";

export type { LaczyTeamFixture };

export function isFixtureInPast(fixture: LaczyTeamFixture, now = new Date()): boolean {
  const t = new Date(fixture.dateTime).getTime();
  if (!Number.isFinite(t)) return false;
  return t < now.getTime();
}

/**
 * Scalanie terminarza przy odświeżeniu:
 * - mecze przeszłe z bazy zostają bez zmian,
 * - nowe / przyszłe z API nadpisują przyszłe,
 * - przeszłe z API dodajemy tylko gdy ich jeszcze nie było.
 */
export function mergeLaczyFixtures(
  existing: LaczyTeamFixture[],
  incoming: LaczyTeamFixture[],
  now = new Date()
): LaczyTeamFixture[] {
  const byId = new Map<string, LaczyTeamFixture>();

  for (const f of existing) {
    byId.set(f.matchId, f);
  }

  if (existing.length === 0) {
    for (const f of incoming) byId.set(f.matchId, f);
    return [...byId.values()].sort((a, b) => a.dateTime.localeCompare(b.dateTime));
  }

  const incomingUpcomingIds = new Set<string>();
  for (const f of incoming) {
    if (isFixtureInPast(f, now)) {
      if (!byId.has(f.matchId)) byId.set(f.matchId, f);
      continue;
    }
    incomingUpcomingIds.add(f.matchId);
    byId.set(f.matchId, f);
  }

  // Usuń przyszłe mecze, których już nie ma w API (odwołane / przełożone poza listę).
  for (const [id, f] of [...byId.entries()]) {
    if (isFixtureInPast(f, now)) continue;
    if (existing.some((e) => e.matchId === id) && !incomingUpcomingIds.has(id)) {
      byId.delete(id);
    }
  }

  return [...byId.values()].sort((a, b) => a.dateTime.localeCompare(b.dateTime));
}

export function inferCompetitionFromPlayName(playName: string): MicrocycleMatchCompetition {
  const s = playName.toLowerCase();
  if (/puchar|cup/.test(s)) return "cup";
  if (/towarzysk|sparing|friendly/.test(s)) return "friendly";
  return "league";
}

export function fixtureToMicrocycleMatch(
  fixture: LaczyTeamFixture,
  ourTeamId: string
): MicrocycleMatch {
  const dt = new Date(fixture.dateTime);
  const valid = !Number.isNaN(dt.getTime());
  const weekStart = startOfWeekMonday(valid ? dt : new Date());
  // Indeks dnia z daty kalendarzowej (nie z ułamka ms — 18:00 ≠ Nd przez Math.round).
  const dayIndex = valid
    ? Math.min(6, Math.max(0, Math.floor((startOfDay(dt).getTime() - weekStart.getTime()) / 86_400_000)))
    : 5;
  const hh = valid
    ? `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`
    : "18:00";
  const isHome = fixture.hostId.toLowerCase() === ourTeamId.toLowerCase();
  const opponent = isHome ? fixture.guestName : fixture.hostName;
  return sanitizeMicrocycleMatch({
    dayIndex,
    kickoffTime: hh,
    opponent,
    venue: isHome ? "home" : "away",
    competition: inferCompetitionFromPlayName(fixture.playName),
    venueAddress: fixture.stadium || "",
  });
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function weekStartIsoFromFixture(fixture: LaczyTeamFixture): string {
  const dt = new Date(fixture.dateTime);
  const base = Number.isNaN(dt.getTime()) ? new Date() : dt;
  return toIsoDateLocal(startOfWeekMonday(base));
}

export function formatFixtureLabel(fixture: LaczyTeamFixture, ourTeamId: string): string {
  const isHome = fixture.hostId.toLowerCase() === ourTeamId.toLowerCase();
  const opp = isHome ? fixture.guestName : fixture.hostName;
  const vs = isHome ? `vs ${opp}` : `@ ${opp}`;
  const d = new Date(fixture.dateTime);
  const datePart = Number.isNaN(d.getTime())
    ? fixture.dateTime
    : d.toLocaleString("pl-PL", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
  return `${datePart} · ${vs}`;
}

/** Usuwa mikrocykl wraz z planami/przypisaniami i aktualizuje liczniki. */
export function removeMicrocycleFromState(
  state: TrainingMicrocycleState,
  microcycleId: string
): TrainingMicrocycleState {
  const target = state.microcycles.find((m) => m.id === microcycleId);
  if (!target) return state;

  const removedAssignments = state.assignments.filter((a) => a.microcycleId === microcycleId);
  let trainingCounts = state.trainingCounts;
  for (const a of removedAssignments) {
    trainingCounts = applyTrainingCountDelta(trainingCounts, a.templateId, -1);
  }

  const microcycles = renumberSeasonMicrocycles(
    state.microcycles.filter((m) => m.id !== microcycleId),
    target.seasonId
  );
  const assignments = state.assignments.filter((a) => a.microcycleId !== microcycleId);
  const dayPlans = (state.dayPlans ?? []).filter((p) => p.microcycleId !== microcycleId);
  const proceduralTasks = (state.proceduralTasks ?? []).filter(
    (t) => t.microcycleId !== microcycleId
  );
  const inSeason = microcyclesForSeason(microcycles, target.seasonId);
  const activeMicrocycleId =
    state.activeMicrocycleId === microcycleId
      ? (inSeason[inSeason.length - 1]?.id ?? inSeason[0]?.id ?? null)
      : state.activeMicrocycleId;

  return {
    ...state,
    microcycles,
    assignments,
    dayPlans,
    proceduralTasks,
    trainingBlocks: (state.trainingBlocks ?? []).filter((b) => b.microcycleId !== microcycleId),
    trainingCounts,
    activeMicrocycleId,
  };
}

/** Ustawia tydzień i mecz(e) aktywnego mikrocyklu z jednego meczu terminarza. */
export function applyFixtureToActiveMicrocycle(
  state: TrainingMicrocycleState,
  fixture: LaczyTeamFixture,
  ourTeamId: string
): TrainingMicrocycleState {
  if (!state.activeMicrocycleId) return state;
  const weekStartIso = weekStartIsoFromFixture(fixture);
  const match = fixtureToMicrocycleMatch(fixture, ourTeamId);
  return {
    ...state,
    microcycles: state.microcycles.map((m) =>
      m.id === state.activeMicrocycleId
        ? { ...m, weekStartIso, matches: [match] }
        : m
    ),
  };
}

function groupFixturesByWeek(fixtures: LaczyTeamFixture[]): Map<string, LaczyTeamFixture[]> {
  const map = new Map<string, LaczyTeamFixture[]>();
  for (const f of fixtures) {
    const key = weekStartIsoFromFixture(f);
    const list = map.get(key) ?? [];
    list.push(f);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.dateTime.localeCompare(b.dateTime));
  }
  return map;
}

/**
 * Tworzy / uzupełnia mikrocykle w sezonie na podstawie terminarza (1 mikrocykl = 1 tydzień pn–nd).
 * Istniejące mikrocykle z tą samą datą poniedziałku dostają zaktualizowane mecze.
 */
export function upsertMicrocyclesFromFixtures(
  state: TrainingMicrocycleState,
  seasonId: string,
  ourTeamId: string,
  fixtures: LaczyTeamFixture[]
): TrainingMicrocycleState {
  if (!seasonId || fixtures.length === 0) return state;
  const byWeek = groupFixturesByWeek(fixtures);
  const weekKeys = [...byWeek.keys()].sort();
  let microcycles = [...state.microcycles];
  let nextNumber = nextMicrocycleNumber(microcycles, seasonId);
  let lastId: string | null = state.activeMicrocycleId;

  for (const weekStartIso of weekKeys) {
    const weekFixtures = byWeek.get(weekStartIso) ?? [];
    const matches = weekFixtures
      .slice(0, 2)
      .map((f) => fixtureToMicrocycleMatch(f, ourTeamId));
    if (matches.length === 0) matches.push(createDefaultMicrocycleMatch(5));

    const existingIdx = microcycles.findIndex(
      (m) => m.seasonId === seasonId && m.weekStartIso === weekStartIso
    );
    if (existingIdx >= 0) {
      const prev = microcycles[existingIdx];
      microcycles[existingIdx] = { ...prev, matches };
      lastId = prev.id;
      continue;
    }

    const id = generateMicrocycleId();
    const created: TrainingMicrocycle = {
      id,
      seasonId,
      number: nextNumber++,
      weekStartIso,
      matches,
      daySchedules: [],
    };
    microcycles.push(created);
    lastId = id;
  }

  return {
    ...state,
    microcycles,
    activeMicrocycleId: lastId ?? state.activeMicrocycleId,
  };
}

/** Sortowanie terminarza: najpierw nadchodzące, potem przeszłe. */
export function sortFixturesForDisplay(
  fixtures: LaczyTeamFixture[],
  now = new Date()
): LaczyTeamFixture[] {
  const nowMs = now.getTime();
  return [...fixtures].sort((a, b) => {
    const ta = new Date(a.dateTime).getTime();
    const tb = new Date(b.dateTime).getTime();
    const aFuture = Number.isFinite(ta) && ta >= nowMs;
    const bFuture = Number.isFinite(tb) && tb >= nowMs;
    if (aFuture !== bFuture) return aFuture ? -1 : 1;
    if (aFuture) return ta - tb;
    return tb - ta;
  });
}

export type WeekFixtureHit = {
  fixture: LaczyTeamFixture;
  /** 0 = pn … 6 = nd w tygodniu mikrocyklu */
  dayIndex: number;
};

/**
 * Mecze z terminarza przypadające w tygodniu mikrocyklu (pn–nd od weekStartIso).
 * Używane m.in. do podświetlenia meczów „podglądu” w siatce.
 */
export function fixturesInWeekByDay(
  fixtures: LaczyTeamFixture[],
  weekStartIso: string
): WeekFixtureHit[] {
  if (!weekStartIso || fixtures.length === 0) return [];
  const weekStart = parseIsoDateLocal(weekStartIso);
  const weekEnd = addDays(weekStart, 7);
  const weekStartMs = weekStart.getTime();
  const weekEndMs = weekEnd.getTime();
  const out: WeekFixtureHit[] = [];
  for (const fixture of fixtures) {
    const dt = new Date(fixture.dateTime);
    if (Number.isNaN(dt.getTime())) continue;
    const day = startOfDay(dt);
    const t = day.getTime();
    if (t < weekStartMs || t >= weekEndMs) continue;
    const dayIndex = Math.min(
      6,
      Math.max(0, Math.floor((t - weekStartMs) / 86_400_000))
    );
    out.push({ fixture, dayIndex });
  }
  return out.sort(
    (a, b) => a.dayIndex - b.dayIndex || a.fixture.dateTime.localeCompare(b.fixture.dateTime)
  );
}

/** Eksport pomocniczy do testów tygodnia. */
export function addDaysIso(iso: string, days: number): string {
  return toIsoDateLocal(addDays(parseIsoDateLocal(iso), days));
}
