import type {
  LaczyTeamFixture,
  MicrocycleMatch,
  MicrocycleWeatherCondition,
  TrainingMicrocycleState,
} from "@/types/trainingMicrocycle";
import {
  kickoffIsoFromMicrocycleDay,
  isWithinForecastHorizon,
} from "@/utils/matchWeather";
import { sanitizeMicrocycleMatch } from "@/utils/microcycleMatches";
import {
  fixtureToMicrocycleMatch,
  weekStartIsoFromFixture,
} from "@/utils/microcycleFixtures";

export interface WeatherQueryItem {
  id: string;
  microcycleId: string;
  matchIndex: number;
  venueAddress: string;
  kickoffIso: string;
}

export interface WeatherResultItem {
  id: string;
  ok: boolean;
  weatherCondition?: string;
  weatherTempC?: number;
}

/** Zbiera mecze z adresem w horyzoncie prognozy (do batch API). */
export function collectWeatherQueries(
  state: TrainingMicrocycleState,
  now = new Date()
): WeatherQueryItem[] {
  const out: WeatherQueryItem[] = [];
  for (const mc of state.microcycles) {
    mc.matches.forEach((match, matchIndex) => {
      const q = buildWeatherQueryForMatch(mc.id, mc.weekStartIso, match, matchIndex, now);
      if (q) out.push(q);
    });
  }
  return out.slice(0, 24);
}

/**
 * Jedno zapytanie pogodowe na mecz — godzina kickoffu z karty MD.
 * null = brak adresu albo poza horyzontem Open-Meteo (~10 dni).
 */
export function buildWeatherQueryForMatch(
  microcycleId: string,
  weekStartIso: string,
  match: MicrocycleMatch,
  matchIndex: number,
  now = new Date()
): WeatherQueryItem | null {
  const address = match.venueAddress.trim();
  if (!address) return null;
  const kickoffIso = kickoffIsoFromMicrocycleDay(
    weekStartIso,
    match.dayIndex,
    match.kickoffTime
  );
  if (!kickoffIso || !isWithinForecastHorizon(kickoffIso, now)) return null;
  return {
    id: `${microcycleId}:${matchIndex}`,
    microcycleId,
    matchIndex,
    venueAddress: address,
    kickoffIso,
  };
}

/** Dlaczego nie da się pobrać pogody — komunikat dla UI. */
export function weatherFetchBlockReason(
  weekStartIso: string,
  match: MicrocycleMatch,
  now = new Date()
): string | null {
  if (!match.venueAddress.trim()) {
    return "Uzupełnij adres stadionu, żeby pobrać pogodę.";
  }
  const kickoffIso = kickoffIsoFromMicrocycleDay(
    weekStartIso,
    match.dayIndex,
    match.kickoffTime
  );
  if (!kickoffIso) return "Brak poprawnej godziny meczu.";
  if (!isWithinForecastHorizon(kickoffIso, now)) {
    return "Prognoza dostępna ok. 10 dni przed meczem.";
  }
  return null;
}

export function applyWeatherResultsToState(
  state: TrainingMicrocycleState,
  results: WeatherResultItem[]
): TrainingMicrocycleState {
  if (results.length === 0) return state;
  const byId = new Map(results.filter((r) => r.ok).map((r) => [r.id, r]));
  if (byId.size === 0) return state;

  return {
    ...state,
    microcycles: state.microcycles.map((mc) => {
      let changed = false;
      const matches = mc.matches.map((match, matchIndex) => {
        const r = byId.get(`${mc.id}:${matchIndex}`);
        if (!r || r.weatherCondition == null || r.weatherTempC == null) return match;
        changed = true;
        return sanitizeMicrocycleMatch({
          ...match,
          weatherCondition: r.weatherCondition as MicrocycleWeatherCondition,
          weatherTempC: r.weatherTempC,
        });
      });
      return changed ? { ...mc, matches } : mc;
    }),
  };
}

/** Patch pogody na pojedynczy mecz (np. po apply fixture). */
export function patchMatchWeather(
  match: MicrocycleMatch,
  weatherCondition: MicrocycleWeatherCondition,
  weatherTempC: number
): MicrocycleMatch {
  return sanitizeMicrocycleMatch({
    ...match,
    weatherCondition,
    weatherTempC,
  });
}

/**
 * Po pobraniu terminarza: uzupełnia adres (i przeciwnika/godzinę) meczów
 * w istniejących mikrocyklach z pasującym tygodniem — żeby dało się pobrać pogodę.
 */
export function syncFixtureDetailsOntoMicrocycles(
  state: TrainingMicrocycleState,
  fixtures: LaczyTeamFixture[],
  ourTeamId: string
): TrainingMicrocycleState {
  if (!ourTeamId || fixtures.length === 0) return state;
  const byWeek = new Map<string, ReturnType<typeof fixtureToMicrocycleMatch>[]>();
  for (const f of fixtures) {
    if (!f.stadium?.trim()) continue;
    const week = weekStartIsoFromFixture(f);
    const match = fixtureToMicrocycleMatch(f, ourTeamId);
    const list = byWeek.get(week) ?? [];
    list.push(match);
    byWeek.set(week, list);
  }
  if (byWeek.size === 0) return state;

  return {
    ...state,
    microcycles: state.microcycles.map((mc) => {
      const fromFixtures = byWeek.get(mc.weekStartIso);
      if (!fromFixtures?.length) return mc;
      const byDay = new Map(fromFixtures.map((m) => [m.dayIndex, m]));
      let changed = false;
      const matches = mc.matches.map((m) => {
        const src = byDay.get(m.dayIndex);
        if (!src) return m;
        changed = true;
        return sanitizeMicrocycleMatch({
          ...m,
          venueAddress: src.venueAddress || m.venueAddress,
          opponent: src.opponent || m.opponent,
          kickoffTime: src.kickoffTime || m.kickoffTime,
          venue: src.venue,
          competition: src.competition,
        });
      });
      return changed ? { ...mc, matches } : mc;
    }),
  };
}
