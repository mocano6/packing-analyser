// Persystencja listy rozgrywek (sezony + grupy lig) w localStorage — unika ponownego scrapingu po F5.

import type { ScoutingLeagueGroup, ScoutingSeason, Sex } from '@/types/scouting';

const STORAGE_KEY = 'scouting_competitions_cache';
const VERSION = 2;

export interface SexCompetitionsCache {
  seasons: ScoutingSeason[];
  /** Grupy lig per seasonId. */
  leagueGroupsBySeason: Record<string, ScoutingLeagueGroup[]>;
  seasonId: string;
  /** Zaznaczone ligi do synchronizacji. */
  leagueIds: string[];
  savedAt: string;
}

export interface ScoutingCompetitionsStore {
  version: typeof VERSION;
  lastSex: Sex;
  bySex: Partial<Record<Sex, SexCompetitionsCache>>;
}

export interface RestoredCompetitions {
  seasons: ScoutingSeason[];
  leagueGroups: ScoutingLeagueGroup[];
  selectedSeasonId: string | null;
  seasonId: string;
  leagueIds: string[];
  savedAt: string;
}

const canUseLocalStorage = (): boolean => {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
};

const isSeason = (v: unknown): v is ScoutingSeason =>
  !!v &&
  typeof v === 'object' &&
  typeof (v as ScoutingSeason).id === 'string' &&
  typeof (v as ScoutingSeason).name === 'string';

const isLeagueGroup = (v: unknown): v is ScoutingLeagueGroup =>
  !!v &&
  typeof v === 'object' &&
  typeof (v as ScoutingLeagueGroup).id === 'string' &&
  Array.isArray((v as ScoutingLeagueGroup).leagues);

const parseLeagueIds = (o: Record<string, unknown>): string[] => {
  if (Array.isArray(o.leagueIds) && o.leagueIds.every((x) => typeof x === 'string')) {
    return o.leagueIds as string[];
  }
  if (typeof o.leagueId === 'string' && o.leagueId) return [o.leagueId];
  return [];
};

const parseSexBlock = (raw: unknown): SexCompetitionsCache | null => {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.seasons) || !o.seasons.every(isSeason)) return null;
  if (!o.leagueGroupsBySeason || typeof o.leagueGroupsBySeason !== 'object') return null;
  const leagueGroupsBySeason: Record<string, ScoutingLeagueGroup[]> = {};
  for (const [k, v] of Object.entries(o.leagueGroupsBySeason as Record<string, unknown>)) {
    if (Array.isArray(v) && v.every(isLeagueGroup)) leagueGroupsBySeason[k] = v;
  }
  const seasons = o.seasons as ScoutingSeason[];
  return {
    seasons,
    leagueGroupsBySeason,
    seasonId:
      typeof o.seasonId === 'string' && seasons.some((s) => s.id === o.seasonId)
        ? (o.seasonId as string)
        : seasons.find((s) => s.isCurrent)?.id ?? seasons[0]?.id ?? '',
    leagueIds: parseLeagueIds(o),
    savedAt: typeof o.savedAt === 'string' ? o.savedAt : new Date(0).toISOString(),
  };
};

export const loadScoutingCompetitionsStore = (): ScoutingCompetitionsStore | null => {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ScoutingCompetitionsStore> & { version?: number };
    if (parsed.version !== VERSION && parsed.version !== 1) return null;
    const lastSex = parsed.lastSex === 'female' ? 'female' : 'male';
    const bySex: Partial<Record<Sex, SexCompetitionsCache>> = {};
    if (parsed.bySex?.male) {
      const b = parseSexBlock(parsed.bySex.male);
      if (b) bySex.male = b;
    }
    if (parsed.bySex?.female) {
      const b = parseSexBlock(parsed.bySex.female);
      if (b) bySex.female = b;
    }
    if (!bySex.male && !bySex.female) return null;
    return { version: VERSION, lastSex, bySex };
  } catch {
    return null;
  }
};

const saveStore = (store: ScoutingCompetitionsStore): void => {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
};

/** Przywraca zapisane rozgrywki dla danej płci (null gdy brak cache). */
export const restoreCompetitionsForSex = (sex: Sex): RestoredCompetitions | null => {
  const store = loadScoutingCompetitionsStore();
  const block = store?.bySex[sex];
  if (!block || block.seasons.length === 0) return null;
  const sid =
    block.seasonId && block.seasons.some((s) => s.id === block.seasonId)
      ? block.seasonId
      : block.seasons.find((s) => s.isCurrent)?.id ?? block.seasons[0].id;
  const leagueGroups = block.leagueGroupsBySeason[sid] ?? [];
  return {
    seasons: block.seasons,
    leagueGroups,
    selectedSeasonId: sid,
    seasonId: sid,
    leagueIds: block.leagueIds,
    savedAt: block.savedAt,
  };
};

/** Zapisuje pełną odpowiedź API po udanym pobraniu. */
export const saveCompetitionsFetch = (
  sex: Sex,
  data: {
    seasons: ScoutingSeason[];
    leagueGroups: ScoutingLeagueGroup[];
    selectedSeasonId: string | null;
  },
  selection: { seasonId: string; leagueIds: string[] }
): void => {
  const store = loadScoutingCompetitionsStore() ?? { version: VERSION, lastSex: sex, bySex: {} };
  const prev = store.bySex[sex];
  const seasonKey = data.selectedSeasonId || selection.seasonId;
  const leagueGroupsBySeason = { ...(prev?.leagueGroupsBySeason ?? {}) };
  if (seasonKey && data.leagueGroups.length > 0) {
    leagueGroupsBySeason[seasonKey] = data.leagueGroups;
  }
  const allLeagueIds = data.leagueGroups.flatMap((g) => g.leagues.map((l) => l.leagueId));
  const leagueIds =
    selection.leagueIds.length > 0
      ? selection.leagueIds.filter((id) => allLeagueIds.includes(id))
      : prev?.leagueIds?.length
        ? prev.leagueIds
        : allLeagueIds;
  store.bySex[sex] = {
    seasons: data.seasons,
    leagueGroupsBySeason,
    seasonId: selection.seasonId || seasonKey || '',
    leagueIds,
    savedAt: new Date().toISOString(),
  };
  store.lastSex = sex;
  saveStore(store);
};

/** Aktualizuje wybór sezon + zaznaczone ligi (bez ponownego fetchu). */
export const saveCompetitionsSelection = (sex: Sex, seasonId: string, leagueIds: string[]): void => {
  const store = loadScoutingCompetitionsStore();
  const block = store?.bySex[sex];
  if (!store || !block) return;
  store.bySex[sex] = { ...block, seasonId, leagueIds };
  store.lastSex = sex;
  saveStore(store);
};

/** Podmienia grupy lig dla sezonu z cache (bez API). */
export const getCachedLeagueGroups = (sex: Sex, seasonId: string): ScoutingLeagueGroup[] | null => {
  const block = loadScoutingCompetitionsStore()?.bySex[sex];
  const groups = block?.leagueGroupsBySeason[seasonId];
  return groups && groups.length > 0 ? groups : null;
};

/** Wszystkie leagueId z grup ligowych sezonu. */
export const allLeagueIdsFromGroups = (groups: ScoutingLeagueGroup[]): string[] =>
  groups.flatMap((g) => g.leagues.map((l) => l.leagueId));

/** Wysyła cache rozgrywek do serwera (bootstrap URL syncu bez ponownego scrapingu). */
export const pushCompetitionsToServer = async (
  sex: Sex,
  seasonId: string,
  leagueGroups: ScoutingLeagueGroup[]
): Promise<void> => {
  if (!seasonId || leagueGroups.length === 0) return;
  try {
    await fetch('/api/scouting/competitions-cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sex, seasonId, leagueGroups }),
    });
  } catch {
    /* best-effort */
  }
};

/** Szuka leagueGroupId w cache localStorage (klient). */
export const findLeagueGroupIdInCache = (sex: Sex, seasonId: string, leagueId: string): string | null => {
  const groups = getCachedLeagueGroups(sex, seasonId);
  if (!groups) return null;
  for (const g of groups) {
    if (g.leagues.some((l) => l.leagueId === leagueId)) return g.id;
  }
  return null;
};
