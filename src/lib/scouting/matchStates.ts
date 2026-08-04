/**
 * Stany meczów z API Łączy Nas Piłka / logika sync scouting.
 * Walkower = mecz bez składu i zdarzeń — nie pobieramy events, nie blokuje „kompletności” ligi.
 */

export const PLAYED_MATCH_STATE = 'Rozegrany';
export const WALKOVER_MATCH_STATE = 'Walkover';

export function isWalkoverMatchState(state: string | null | undefined): boolean {
  return (state || '').trim().toLowerCase() === 'walkover';
}

export function isPlayedMatchState(state: string | null | undefined): boolean {
  return (state || '').trim() === PLAYED_MATCH_STATE;
}

/** Mecze, dla których ma sens pobieranie zdarzeń / składu (nie walkower). */
export function isPlayableForEvents(state: string | null | undefined): boolean {
  return !isWalkoverMatchState(state);
}

/**
 * Zdarzenia meczu zostały już pobrane (sukces HTTP) — także gdy skład jest pusty (`[]`).
 * Puste składy (brak danych w API) nie mogą ponownie wchodzić do kolejki sync.
 */
export function matchEventsResolved(m: { playerStats?: unknown[] | null } | null | undefined): boolean {
  return Array.isArray(m?.playerStats);
}

/** Czy mecz ma zapisane nietrywialne statystyki zawodników (skład niepusty). */
export function matchHasPlayerStats(m: { playerStats?: unknown[] | null }): boolean {
  return Array.isArray(m.playerStats) && m.playerStats.length > 0;
}

/**
 * Czy mecz wymaga pobrania events:
 * - nie walkower
 * - brak zapisanych events (nawet pustych) LUB mecz w oknie przyrostowym (po lastUpdated)
 */
export function matchNeedsEventFetch(
  m: { matchId: string; dateTime: string; state?: string | null },
  opts: {
    now: Date;
    existing: { playerStats?: unknown[] | null } | null | undefined;
    lastUpdated: Date | null;
  }
): boolean {
  if (isWalkoverMatchState(m.state)) return false;
  if (!isPlayedMatchState(m.state) && m.state) {
    // Nieznany / przyszły stan — nie pobieramy events (np. zaplanowany).
    // Brak state traktujemy jak potencjalnie rozegrany (stare dane).
    const s = (m.state || '').trim();
    if (s && s !== PLAYED_MATCH_STATE) return false;
  }
  const missingEvents = !opts.existing || !matchEventsResolved(opts.existing);
  const inWindow = !opts.lastUpdated || new Date(m.dateTime) > opts.lastUpdated;
  return missingEvents || inWindow;
}

export function countWalkoverMatches(matches: Array<{ state?: string | null }>): number {
  return matches.filter((m) => isWalkoverMatchState(m.state)).length;
}

export function countMatchesWithPlayerStats(matches: Array<{ playerStats?: unknown[] | null }>): number {
  return matches.filter(matchHasPlayerStats).length;
}

export function countMatchesWithEventsResolved(
  matches: Array<{ playerStats?: unknown[] | null }>
): number {
  return matches.filter(matchEventsResolved).length;
}

type MatchLike = { state?: string | null; playerStats?: unknown[] | null };

/** Liga „kompletna” pod sync: każdy mecz nie-WO ma już pobrane events (także puste składy). */
export function isLeagueEventsComplete(matches: MatchLike[]): boolean {
  const playable = matches.filter((m) => isPlayableForEvents(m.state));
  if (playable.length === 0) return matches.length > 0;
  return playable.every(matchEventsResolved);
}

/**
 * Czy warto pomijać sync (sezon historyczny + events kompletne + brak brakujących profili).
 * Sezon bieżący zawsze warto odświeżyć (mogą dojść mecze).
 */
export function shouldSkipMatchSync(opts: {
  isCurrentSeason: boolean;
  matches: MatchLike[];
  playersNeedingProfile: number;
}): boolean {
  if (opts.isCurrentSeason) return false;
  if (opts.playersNeedingProfile > 0) return false;
  return isLeagueEventsComplete(opts.matches);
}
