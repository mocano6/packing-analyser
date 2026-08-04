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
      const address = match.venueAddress.trim();
      if (!address) return;
      const kickoffIso = kickoffIsoFromMicrocycleDay(
        mc.weekStartIso,
        match.dayIndex,
        match.kickoffTime
      );
      if (!kickoffIso || !isWithinForecastHorizon(kickoffIso, now)) return;
      out.push({
        id: `${mc.id}:${matchIndex}`,
        microcycleId: mc.id,
        matchIndex,
        venueAddress: address,
        kickoffIso,
      });
    });
  }
  return out.slice(0, 24);
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
