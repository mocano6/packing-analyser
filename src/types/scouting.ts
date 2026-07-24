// Typy dla modułu scoutingu (dane z rozgrywek laczynaspilka.pl).
// Model zaprojektowany tak, aby w przyszłości łatwo przenieść magazyn do Firestore.

export type Sex = 'male' | 'female';

/** Sezon rozgrywkowy (z endpointu seasons/dictionaries). */
export interface ScoutingSeason {
  id: string;
  name: string;
  isCurrent: boolean;
}

/** Liga w obrębie grupy ligowej. */
export interface ScoutingLeague {
  leagueId: string;
  name: string;
}

/** Grupa ligowa (Ekstraklasa, Pierwsza liga, ...) z endpointu league-groups. */
export interface ScoutingLeagueGroup {
  id: string;
  name: string;
  subTitle?: string;
  dropdowns?: string;
  leagues: ScoutingLeague[];
}

/** Konfiguracja bieżącego zakresu scoutingu (którą ligę/sezon zbieramy). */
export interface ScoutingConfig {
  seasonId: string;
  seasonName: string;
  leagueId: string;
  leagueName: string;
  sex: Sex;
  /** Grupa ligowa (do URL SPA /rozgrywki) — opcjonalna, ale wymagana dla stabilnego tokenu. */
  leagueGroupId?: string;
}

/** Drużyna w meczu. */
export interface ScoutingTeamRef {
  id: string;
  name: string;
  abbreviation?: string;
  logo?: string;
}

/** Statystyka pojedynczego zawodnika w danym meczu (wyliczona ze zdarzeń). */
export interface ScoutingPlayerMatchStat {
  playerId: string;
  firstname: string;
  lastname: string;
  number: number | null;
  teamId: string;
  teamName: string;
  isStarter: boolean;
  /** Minuty rozegrane (wyliczone ze składu, zmian i czerwonych kartek). */
  minutesPlayed: number;
  /** Bramki zdobyte (bez samobójczych). */
  goals: number;
  /** Minuty, w których padły bramki tego zawodnika. */
  goalMinutes: number[];
  ownGoals: number;
  yellowCards: number;
  redCards: number;
  subInMinute: number | null;
  subOutMinute: number | null;
}

/** Rozegrany mecz z wynikiem i (opcjonalnie) statystykami zawodników. */
export interface ScoutedMatch {
  matchId: string;
  dateTime: string; // ISO
  queue: number | null; // kolejka
  round?: string;
  state: string; // np. "Rozegrany"
  stadium?: string;
  host: ScoutingTeamRef;
  guest: ScoutingTeamRef;
  scoreFinal: string | null; // np. "3:0"
  scoreHalf: string | null;
  /** Statystyki zawodników (jeśli pobrano zdarzenia). */
  playerStats?: ScoutingPlayerMatchStat[];
  /** Kiedy ten rekord został pobrany/zaktualizowany. */
  fetchedAt: string; // ISO
}

/** Metadane pojedynczej synchronizacji. */
export interface ScoutingSyncMeta {
  at: string;
  checkedMatches: number;
  newMatches: number;
  updatedMatches: number;
  errors: string[];
}

/** Dane jednej śledzonej ligi (w danym sezonie). */
export interface ScoutingLeagueData {
  config: ScoutingConfig;
  /** ISO ostatniej udanej synchronizacji (do inkrementalnego pobierania). */
  lastUpdatedAt: string | null;
  /** Czy sezon jest bieżący (ligi z zakończonych sezonów nie wymagają odświeżania). */
  isCurrentSeason: boolean;
  matches: ScoutedMatch[];
  lastSync?: ScoutingSyncMeta;
}

/** Wiek i rok urodzenia zapisane w kontekście konkretnego sezonu. */
export interface ScoutingPlayerSeasonProfile {
  age: number | null;
  birthYear: number | null;
  fetchedAt: string;
}

/** Informacje o zawodniku (z zakładki zawodnika) — cache współdzielony między ligami. */
export interface ScoutingPlayerInfo {
  id: string;
  firstname: string;
  lastname: string;
  /** Ostatni znany wiek (legacy — preferuj bySeason). */
  age: number | null;
  /** Ostatni wyliczony rok urodzenia (legacy — preferuj bySeason). */
  birthYear?: number | null;
  citizenship?: string;
  clubName?: string;
  fetchedAt: string; // ISO
  /** Wiek/rok urodzenia per sezon (klucz = seasonId). */
  bySeason?: Record<string, ScoutingPlayerSeasonProfile>;
  /** true po pobraniu pełnego profilu z API players/{id} dla danego sezonu. */
  apiProfile?: boolean;
}

/** Klucz ligi w magazynie: `${seasonId}:${leagueId}`. */
export const leagueKey = (seasonId: string, leagueId: string): string => `${seasonId}:${leagueId}`;

/** Pełny stan bazy scoutingu — wiele lig + cache zawodników. */
export interface ScoutingState {
  /** Słownik śledzonych lig, klucz = `${seasonId}:${leagueId}`. */
  leagues: Record<string, ScoutingLeagueData>;
  /** Cache danych zawodników (wiek itd.), klucz = playerId. */
  players: Record<string, ScoutingPlayerInfo>;
}

/** Wynik operacji synchronizacji zwracany do UI. */
export interface ScoutingSyncResult {
  ok: boolean;
  message: string;
  leagueKey: string;
  checkedMatches: number;
  newMatches: number;
  updatedMatches: number;
  fetchedPlayers: number;
  /** Mecze rozegrane bez statystyk — pozostałe po limicie partii. */
  matchesRemaining?: number;
  /** Zawodnicy bez pełnego profilu API — pozostałe po limicie partii. */
  playersRemaining?: number;
  errors: string[];
  state: ScoutingState;
  debugLog?: ScoutingDebugLog;
}

export type ScoutingDebugLevel = 'info' | 'ok' | 'warn' | 'error';

export interface ScoutingDebugEntry {
  at: string;
  level: ScoutingDebugLevel;
  phase: 'browser' | 'navigate' | 'token' | 'api' | 'sync' | 'client';
  message: string;
  endpoint?: string;
  status?: number;
  detail?: string;
}

/** Pełny log jednej operacji scoutingu (do modala debugowania). */
export interface ScoutingDebugLog {
  operation: string;
  sessionId: string;
  startedAt: string;
  finishedAt: string;
  meta?: Record<string, string>;
  entries: ScoutingDebugEntry[];
}
