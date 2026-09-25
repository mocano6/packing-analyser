import type {
  WyscoutCompetition,
  WyscoutMatchAdvancedStats,
  WyscoutSearchObjType,
  WyscoutSearchTeam,
  WyscoutSeason,
  WyscoutTeam,
  WyscoutTeamCareer,
  WyscoutTeamMatch,
  WyscoutTeamMatches,
  WyscoutTeamSquad,
} from "@/types/wyscout";
import { wyscoutGet } from "@/lib/wyscout/client";
import { findWyscoutMatchByDate, sortWyscoutMatchesNewestFirst } from "@/utils/wyscoutMatchMatch";
import {
  isPolishIiiLigaCompetition,
  normalizeWyscoutAreas,
  normalizeWyscoutCompetitions,
  normalizeWyscoutSeasons,
  normalizeWyscoutTeams,
  pickDefaultPolishCompetition,
  preferredAreaCodes,
  sortPolishCompetitions,
  WYSCOUT_POLAND_AREA_ID,
} from "@/utils/wyscoutPolishCompetitions";
import { sortWyscoutCareerNewest } from "@/utils/wyscoutStatsDisplay";

const CAREER_LIMIT = 12;
const MATCHES_LIMIT = 40;
const SQUAD_LIMIT = 40;

export function normalizeWyscoutSearchResults(raw: unknown): WyscoutSearchTeam[] {
  const wrapped =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(wrapped?.teams)
      ? wrapped.teams
      : Array.isArray(wrapped?.results)
        ? wrapped.results
        : [];
  return list.filter((item): item is WyscoutSearchTeam => {
    if (!item || typeof item !== "object") return false;
    const rec = item as Record<string, unknown>;
    const wyId = typeof rec.wyId === "number" ? rec.wyId : Number(rec.wyId);
    return Number.isFinite(wyId) && wyId > 0 && typeof rec.name === "string";
  }).map((item) => ({
    ...item,
    wyId: typeof item.wyId === "number" ? item.wyId : Number(item.wyId),
  }));
}

export async function searchWyscoutObjects(
  query: string,
  objType: WyscoutSearchObjType = "team",
  gender?: string,
): Promise<WyscoutSearchTeam[]> {
  const raw = await wyscoutGet<unknown>("/search", {
    query,
    objType,
    gender: gender || undefined,
  });
  return normalizeWyscoutSearchResults(raw).slice(0, 25);
}

export interface WyscoutOverviewPayload {
  team: WyscoutTeam;
  career: WyscoutTeamCareer["career"];
  matches: WyscoutTeamMatch[];
  squad: WyscoutTeamSquad["squad"];
  matchedMatch: WyscoutTeamMatch | null;
  matchStats: WyscoutMatchAdvancedStats | null;
}

export interface WyscoutPolandCatalog {
  competitions: WyscoutCompetition[];
  iiiLiga: WyscoutCompetition[];
  suggestedCompId: number | null;
  warning?: string;
}

function toPolandCatalog(list: WyscoutCompetition[], warning?: string): WyscoutPolandCatalog {
  const competitions = sortPolishCompetitions(list);
  const iiiLiga = competitions.filter((item) => isPolishIiiLigaCompetition(item));
  return {
    competitions,
    iiiLiga,
    suggestedCompId: pickDefaultPolishCompetition(iiiLiga.length ? iiiLiga : competitions)?.wyId ?? null,
    warning,
  };
}

function isLikelyPolishCompetition(comp: WyscoutCompetition): boolean {
  if (comp.area?.alpha3code === "POL" || comp.area?.alpha2code === "PL") return true;
  const n = `${comp.name} ${comp.area?.name ?? ""}`.toLowerCase();
  return n.includes("poland") || n.includes("polska") || n.includes("ekstraklasa");
}

async function searchPolishCompetitions(): Promise<WyscoutCompetition[]> {
  const queries = ["III Liga", "III liga", "3. Liga Poland", "II Liga Poland", "I Liga Poland", "Ekstraklasa"];
  const found = new Map<number, WyscoutCompetition>();
  for (const query of queries) {
    try {
      const raw = await wyscoutGet<unknown>("/search", { query, objType: "competition" });
      for (const item of normalizeWyscoutCompetitions(raw)) {
        if (!isLikelyPolishCompetition(item) && !isPolishIiiLigaCompetition(item)) continue;
        found.set(item.wyId, item);
      }
    } catch {
      // Search bywa poza licencją — próbujemy kolejne frazy.
    }
  }
  return [...found.values()];
}

export async function fetchCompetitionById(compId: number): Promise<WyscoutCompetition> {
  const raw = await wyscoutGet<WyscoutCompetition>(`/competitions/${compId}`);
  const [parsed] = normalizeWyscoutCompetitions([raw]);
  if (!parsed) {
    return { wyId: compId, name: `Rozgrywki ${compId}` };
  }
  return parsed;
}

async function fetchCompetitionsForArea(areaId: string): Promise<WyscoutCompetition[]> {
  const raw = await wyscoutGet<unknown>("/competitions", { areaId });
  return normalizeWyscoutCompetitions(raw);
}

export async function fetchPolishCompetitions(
  seedCompId?: number,
): Promise<WyscoutPolandCatalog> {
  const found = new Map<number, WyscoutCompetition>();

  try {
    const areasRaw = await wyscoutGet<unknown>("/areas");
    const areaCodes = preferredAreaCodes(normalizeWyscoutAreas(areasRaw)).slice(0, 12);
    for (const areaId of areaCodes) {
      try {
        for (const comp of await fetchCompetitionsForArea(areaId)) {
          found.set(comp.wyId, comp);
        }
      } catch {
        // Brak licencji na ten obszar — idziemy dalej.
      }
    }
  } catch {
    try {
      for (const comp of await fetchCompetitionsForArea(WYSCOUT_POLAND_AREA_ID)) {
        found.set(comp.wyId, comp);
      }
    } catch {
      // Lista POL zablokowana.
    }
  }

  if (found.size === 0) {
    for (const comp of await searchPolishCompetitions()) {
      found.set(comp.wyId, comp);
    }
  }

  if (seedCompId && !found.has(seedCompId)) {
    try {
      found.set(seedCompId, await fetchCompetitionById(seedCompId));
    } catch {
      found.set(seedCompId, { wyId: seedCompId, name: `Rozgrywki ${seedCompId}` });
    }
  }

  const list = [...found.values()];
  if (list.length > 0) return toPolandCatalog(list);

  return toPolandCatalog([], "Klucz API nie zwraca listy lig (Forbidden). To zwykle konto platformy zamiast klucza API albo brak katalogu w licencji.");
}

export async function fetchCompetitionSeasons(compId: number): Promise<WyscoutSeason[]> {
  const raw = await wyscoutGet<unknown>(`/competitions/${compId}/seasons`);
  return normalizeWyscoutSeasons(raw);
}

export async function fetchCompetitionOrSeasonTeams(options: {
  compId: number;
  seasonId?: number;
}): Promise<WyscoutTeam[]> {
  if (options.seasonId) {
    const fromSeason = await wyscoutGet<unknown>(`/seasons/${options.seasonId}/teams`).catch(
      () => null,
    );
    const seasonTeams = normalizeWyscoutTeams(fromSeason);
    if (seasonTeams.length > 0) return seasonTeams;
  }
  const raw = await wyscoutGet<unknown>(`/competitions/${options.compId}/teams`);
  return normalizeWyscoutTeams(raw);
}

export async function fetchWyscoutTeamOverview(options: {
  wyId: number;
  teamName?: string;
  matchDate?: string;
  matchWyId?: number;
  seasonId?: number;
}): Promise<WyscoutOverviewPayload> {
  const wyId = String(options.wyId);
  const team = await wyscoutGet<WyscoutTeam>(`/teams/${wyId}`).catch(
    (): WyscoutTeam => ({
      wyId: options.wyId,
      name: options.teamName?.trim() || `Drużyna ${options.wyId}`,
    }),
  );
  const [careerRaw, matchesRaw, squadRaw] = await Promise.all([
    wyscoutGet<WyscoutTeamCareer>(`/teams/${wyId}/career`, {
      details: "season,competition",
    }).catch(() => ({ career: [] })),
    wyscoutGet<WyscoutTeamMatches>(`/teams/${wyId}/matches`, {
      fetch: "team",
      seasonId: options.seasonId,
    }).catch(() => ({ matches: [] })),
    wyscoutGet<WyscoutTeamSquad>(`/teams/${wyId}/squad`).catch(() => ({ squad: [] })),
  ]);

  const career = sortWyscoutCareerNewest(careerRaw.career ?? []).slice(0, CAREER_LIMIT);
  const matches = sortWyscoutMatchesNewestFirst(matchesRaw.matches ?? []).slice(0, MATCHES_LIMIT);
  const squad = (squadRaw.squad ?? []).slice(0, SQUAD_LIMIT);

  const matchedMatch =
    (options.matchWyId
      ? matches.find((m) => m.matchId === options.matchWyId) ?? {
          matchId: options.matchWyId,
        }
      : null) ?? findWyscoutMatchByDate(matches, options.matchDate);

  let matchStats: WyscoutMatchAdvancedStats | null = null;
  if (matchedMatch?.matchId) {
    try {
      matchStats = await wyscoutGet<WyscoutMatchAdvancedStats>(
        `/matches/${matchedMatch.matchId}/advancedstats`,
        { details: "teams,match" },
      );
    } catch {
      matchStats = null;
    }
  }

  return {
    team,
    career,
    matches,
    squad,
    matchedMatch,
    matchStats,
  };
}

export async function fetchWyscoutMatchStats(
  matchWyId: number,
): Promise<WyscoutMatchAdvancedStats> {
  return wyscoutGet<WyscoutMatchAdvancedStats>(`/matches/${matchWyId}/advancedstats`, {
    details: "teams,match",
  });
}
