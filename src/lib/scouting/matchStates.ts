/** Statusy meczów z API laczynaspilka.pl — co wymaga zdarzeń (składy/minuty). */

export const PLAYED_MATCH_STATE = 'Rozegrany';
export const WALKOVER_MATCH_STATE = 'Walkover';

type MatchLike = {
  matchId: string;
  dateTime: string;
  state?: string | null;
  playerStats?: unknown[] | null;
};

/** Walkower — wynik jest, ale bez składu/zdarzeń; nie pobieramy events. */
export function isWalkoverMatchState(state: string | null | undefined): boolean {
  return (state || '').trim().toLowerCase() === WALKOVER_MATCH_STATE.toLowerCase();
}

export function isPlayedMatchState(state: string | null | undefined): boolean {
  return (state || '').trim() === PLAYED_MATCH_STATE;
}

/** Czy mecz ma zapisane statystyki zawodników z events. */
export function matchHasPlayerStats(m: { playerStats?: unknown[] | null }): boolean {
  return Array.isArray(m.playerStats) && m.playerStats.length > 0;
}

/**
 * Czy trzeba pobrać events dla meczu:
 * tylko „Rozegrany”, data w przeszłości, brak statystyk (lub mecz w oknie inkrementalnym).
 * Walkowery i inne statusy — pomijamy.
 */
export function matchNeedsEventFetch(
  m: MatchLike,
  opts: {
    now: Date;
    existing?: MatchLike | null;
    lastUpdated: Date | null;
  }
): boolean {
  if (!isPlayedMatchState(m.state)) return false;
  if (new Date(m.dateTime) > opts.now) return false;
  const missingStats = !opts.existing || !matchHasPlayerStats(opts.existing);
  const inWindow = !opts.lastUpdated || new Date(m.dateTime) > opts.lastUpdated;
  return missingStats || inWindow;
}

export function countWalkoverMatches(matches: Array<{ state?: string | null }>): number {
  return matches.filter((m) => isWalkoverMatchState(m.state)).length;
}

export function countMatchesWithPlayerStats(matches: Array<{ playerStats?: unknown[] | null }>): number {
  return matches.filter(matchHasPlayerStats).length;
}

/**
 * Wszystkie mecze „Rozegrany” mają zdarzenia.
 * Walkowery nie wymagają stats — nie blokują kompletności.
 */
export function isLeagueEventsComplete(matches: MatchLike[]): boolean {
  const playable = matches.filter((m) => isPlayedMatchState(m.state));
  if (playable.length === 0) return matches.length > 0;
  return playable.every(matchHasPlayerStats);
}

/** Czy sync meczów/profili jest zbędny (sezon zakończony + komplet events lokalnie). */
export function shouldSkipMatchSync(opts: {
  isCurrentSeason: boolean;
  matches: MatchLike[];
  playersNeedingProfile: number;
}): boolean {
  if (opts.isCurrentSeason) return false;
  if (opts.playersNeedingProfile > 0) return false;
  return isLeagueEventsComplete(opts.matches);
}
