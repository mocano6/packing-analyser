/** Zapisane minuty naszej drużyny z jednego meczu ŁNP. */
export interface LnpCachedMatchPlayer {
  lnpId: string;
  firstName: string;
  lastName: string;
  number: number;
  minutesPlayed: number;
}

export interface LnpCachedMatchMinutes {
  matchId: string;
  dateTime: string;
  opponent: string;
  isHome: boolean;
  playName: string;
  scoreFinal: string | null;
  /** ISO ostatniego udanego odczytu składu. */
  fetchedAt: string;
  /** False = mecz rozegrany, ale API nie zwróciło składu (walkower / brak danych). */
  hasSquad: boolean;
  players: LnpCachedMatchPlayer[];
}

/** Ręczne połączenie wierszy obciążeń: źródło znika, minuty idą do celu. */
export interface LnpPlayerLoadMerge {
  sourceKey: string;
  targetKey: string;
}

export interface LnpPlayerLoadState {
  matches: LnpCachedMatchMinutes[];
  /** ISO ostatniego batcha pobierania minut. */
  fetchedAt: string | null;
  lnpTeamId: string | null;
  /** Ukryte wiersze (po „Usuń”) — minuty zostają w cache meczów. */
  hiddenPlayerKeys: string[];
  /** Ręczne scalenia duplikatów (PDF vs ŁNP). */
  playerMerges: LnpPlayerLoadMerge[];
}

export const LNP_PLAYER_LOAD_VERSION = 1 as const;

/** Dokument w `teams/{teamId}/staff/` — cache minut meczowych z ŁNP. */
export const LNP_PLAYER_LOAD_DOC_ID = "lnpPlayerLoadState" as const;

export function createEmptyLnpPlayerLoadState(): LnpPlayerLoadState {
  return { matches: [], fetchedAt: null, lnpTeamId: null, hiddenPlayerKeys: [], playerMerges: [] };
}
