import type { ScoutingPlayerInfo, ScoutingPlayerSeasonProfile, ScoutingState } from '@/types/scouting';
import { computeBirthYear } from './birthYear';

/** Parsuje wiek z odpowiedzi API (liczba lub string). */
export function parsePlayerAge(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.floor(raw);
    return n >= 0 && n <= 99 ? n : null;
  }
  if (typeof raw === 'string') {
    const n = parseInt(raw.trim(), 10);
    if (Number.isFinite(n) && n >= 0 && n <= 99) return n;
  }
  return null;
}

/** Wiek i rok urodzenia do wyświetlenia w kontekście sezonu (bySeason + fallback legacy). */
export function resolvePlayerSeasonProfile(
  info: ScoutingPlayerInfo | undefined,
  seasonId: string,
  seasonName?: string
): { age: number | null; birthYear: number | null } {
  const s = info?.bySeason?.[seasonId];
  if (s?.age != null) {
    return {
      age: s.age,
      birthYear: s.birthYear ?? (seasonName ? computeBirthYear(s.age, seasonName) : null),
    };
  }
  // Stary format: samo pole age (bez bySeason) — traktuj jako dane tego sezonu.
  if (info?.age != null) {
    return {
      age: info.age,
      birthYear:
        info.birthYear ?? (seasonName ? computeBirthYear(info.age, seasonName) : null),
    };
  }
  return { age: null, birthYear: null };
}

/** Czy trzeba pobrać profil z API players/{id} (brak wieku w tym sezonie). */
export function needsPlayerProfileFetch(player: ScoutingPlayerInfo | undefined, seasonId: string): boolean {
  if (!player) return true;
  if (player.bySeason?.[seasonId]?.age != null) return false;
  // Legacy age bez bySeason — uznaj za kompletne do czasu migracji / ponownego syncu.
  if (player.age != null && !player.bySeason?.[seasonId]) return false;
  return true;
}

export function mergePlayerSeasonProfile(
  player: ScoutingPlayerInfo,
  seasonId: string,
  seasonName: string,
  age: number | null,
  fetchedAt: string
): ScoutingPlayerInfo {
  const birthYear = age != null ? computeBirthYear(age, seasonName) : null;
  const seasonEntry: ScoutingPlayerSeasonProfile = { age, birthYear, fetchedAt };
  return {
    ...player,
    age: age ?? player.age,
    birthYear: birthYear ?? player.birthYear ?? null,
    bySeason: { ...player.bySeason, [seasonId]: seasonEntry },
    apiProfile: age != null,
  };
}

/** Kolejność: najpierw zawodnicy bez wpisu w cache, potem bez wieku w sezonie. */
export function sortPlayerIdsForProfileFetch(
  ids: string[],
  players: Record<string, ScoutingPlayerInfo>,
  seasonId: string
): string[] {
  return [...ids].sort((a, b) => {
    const pa = players[a];
    const pb = players[b];
    const score = (p: ScoutingPlayerInfo | undefined): number => {
      if (!p) return 0;
      if (!p.bySeason?.[seasonId]) return 1;
      if (p.bySeason[seasonId].age == null) return 2;
      return 3;
    };
    return score(pa) - score(pb);
  });
}

/** Uzupełnia bySeason z legacy age dla zawodników występujących w składach meczów. */
export function migrateLegacyPlayerSeasons(state: ScoutingState): boolean {
  const now = new Date().toISOString();
  let changed = false;
  const playerSeasons = new Map<string, Map<string, string>>();

  for (const ld of Object.values(state.leagues)) {
    const { seasonId, seasonName } = ld.config;
    for (const m of ld.matches) {
      for (const p of m.playerStats || []) {
        if (!playerSeasons.has(p.playerId)) playerSeasons.set(p.playerId, new Map());
        playerSeasons.get(p.playerId)!.set(seasonId, seasonName);
      }
    }
  }

  for (const [playerId, seasons] of playerSeasons) {
    const player = state.players[playerId];
    if (!player) continue;
    for (const [seasonId, seasonName] of seasons) {
      if (player.bySeason?.[seasonId]?.age != null) continue;
      const age = player.bySeason?.[seasonId]?.age ?? player.age;
      if (age == null) continue;
      const birthYear = computeBirthYear(age, seasonName);
      const entry: ScoutingPlayerSeasonProfile = {
        age,
        birthYear,
        fetchedAt: player.fetchedAt || now,
      };
      player.bySeason = { ...player.bySeason, [seasonId]: entry };
      if (player.birthYear == null && birthYear != null) player.birthYear = birthYear;
      if (player.apiProfile === undefined) player.apiProfile = true;
      changed = true;
    }
  }
  return changed;
}

/** Stare dane: apiProfile=true bez wieku blokowało ponowne pobranie. */
export function fixIncompletePlayerProfiles(state: { players: Record<string, ScoutingPlayerInfo> }): boolean {
  let changed = false;
  for (const p of Object.values(state.players)) {
    if (p.age == null && p.apiProfile) {
      p.apiProfile = false;
      changed = true;
    }
  }
  return changed;
}
