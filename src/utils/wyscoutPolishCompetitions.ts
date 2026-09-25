import type { WyscoutArea, WyscoutCompetition, WyscoutSeason, WyscoutTeam } from "@/types/wyscout";

export const WYSCOUT_POLAND_AREA_ID = "POL";

function foldPl(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/ł/g, "l");
}

/** III liga (oficjalna nazwa), nie II liga i nie Ekstraklasa. */
export function isPolishIiiLigaName(name: string): boolean {
  const n = foldPl(name).replace(/[_/]+/g, " ");
  if (/\biii([\s.\-]*liga|\s+league)\b/.test(n)) return true;
  if (/\b3([\s.\-]*liga|rd[\s.\-]+liga|rd[\s.\-]+division)\b/.test(n)) return true;
  return false;
}

export function isPolishIiiLigaCompetition(comp: WyscoutCompetition): boolean {
  if (comp.area?.alpha3code && comp.area.alpha3code !== "POL") return false;
  if (isPolishIiiLigaName(comp.name)) return true;
  const seniorMen =
    (comp.category ?? "default") === "default" && (comp.gender ?? "male") === "male";
  const domesticLeague = (comp.format ?? "Domestic league") === "Domestic league";
  return seniorMen && domesticLeague && comp.divisionLevel === 4;
}

export function sortPolishCompetitions(list: WyscoutCompetition[]): WyscoutCompetition[] {
  return [...list].sort((a, b) => {
    const aIii = isPolishIiiLigaCompetition(a) ? 0 : 1;
    const bIii = isPolishIiiLigaCompetition(b) ? 0 : 1;
    if (aIii !== bIii) return aIii - bIii;
    const aLvl = a.divisionLevel ?? 99;
    const bLvl = b.divisionLevel ?? 99;
    if (aLvl !== bLvl) return aLvl - bLvl;
    return a.name.localeCompare(b.name, "pl");
  });
}

export function pickDefaultPolishCompetition(
  list: WyscoutCompetition[],
): WyscoutCompetition | null {
  return list.find((item) => isPolishIiiLigaCompetition(item)) ?? list[0] ?? null;
}

export function normalizeWyscoutAreas(raw: unknown): WyscoutArea[] {
  const wrapped = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(wrapped?.areas)
      ? wrapped.areas
      : [];
  return list
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const rec = item as Record<string, unknown>;
      const alpha3code = typeof rec.alpha3code === "string" ? rec.alpha3code.trim() : "";
      if (!alpha3code) return null;
      return {
        alpha2code: typeof rec.alpha2code === "string" ? rec.alpha2code : undefined,
        alpha3code,
        id: typeof rec.id === "number" ? rec.id : undefined,
        name: typeof rec.name === "string" ? rec.name : undefined,
      };
    })
    .filter((item): item is WyscoutArea => item != null);
}

export function preferredAreaCodes(areas: WyscoutArea[]): string[] {
  const codes = areas
    .map((area) => area.alpha3code)
    .filter((code): code is string => Boolean(code));
  const unique = [...new Set(codes)];
  return [
    WYSCOUT_POLAND_AREA_ID,
    ...unique.filter((code) => code !== WYSCOUT_POLAND_AREA_ID),
  ];
}

export function normalizeWyscoutCompetitions(raw: unknown): WyscoutCompetition[] {
  const wrapped = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(wrapped?.competitions)
      ? wrapped.competitions
      : [];
  return list
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const rec = item as Record<string, unknown>;
      const wyId = typeof rec.wyId === "number" ? rec.wyId : Number(rec.wyId);
      const name = typeof rec.name === "string" ? rec.name.trim() : "";
      if (!Number.isFinite(wyId) || wyId <= 0 || !name) return null;
      return {
        ...(rec as WyscoutCompetition),
        wyId,
        name,
        divisionLevel: typeof rec.divisionLevel === "number" ? rec.divisionLevel : undefined,
      };
    })
    .filter((item): item is WyscoutCompetition => item != null);
}

export function normalizeWyscoutSeasons(raw: unknown): WyscoutSeason[] {
  const wrapped = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(wrapped?.seasons)
      ? wrapped.seasons
      : [];
  return list
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const rec = item as Record<string, unknown>;
      const nested =
        rec.season && typeof rec.season === "object"
          ? (rec.season as Record<string, unknown>)
          : rec;
      const wyId = typeof nested.wyId === "number" ? nested.wyId : Number(nested.wyId ?? rec.seasonId);
      const name = typeof nested.name === "string" ? nested.name.trim() : "";
      if (!Number.isFinite(wyId) || wyId <= 0) return null;
      return {
        wyId,
        name: name || String(wyId),
        startDate: typeof nested.startDate === "string" ? nested.startDate : undefined,
        endDate: typeof nested.endDate === "string" ? nested.endDate : undefined,
        active: typeof nested.active === "boolean" ? nested.active : undefined,
        competitionId:
          typeof nested.competitionId === "number" ? nested.competitionId : undefined,
      };
    })
    .filter((item): item is WyscoutSeason => item != null)
    .sort((a, b) => (b.startDate || b.name).localeCompare(a.startDate || a.name));
}

export function normalizeWyscoutTeams(raw: unknown): WyscoutTeam[] {
  const wrapped = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(wrapped?.teams)
      ? wrapped.teams
      : [];
  return list
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const rec = item as Record<string, unknown>;
      const wyId = typeof rec.wyId === "number" ? rec.wyId : Number(rec.wyId);
      const name = typeof rec.name === "string" ? rec.name.trim() : "";
      if (!Number.isFinite(wyId) || wyId <= 0 || !name) return null;
      return { ...(rec as WyscoutTeam), wyId, name };
    })
    .filter((item): item is WyscoutTeam => item != null)
    .sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

export function pickActiveOrLatestSeason(seasons: WyscoutSeason[]): WyscoutSeason | null {
  return seasons.find((s) => s.active) ?? seasons[0] ?? null;
}

export function filterTeamsByQuery(teams: WyscoutTeam[], query: string): WyscoutTeam[] {
  const q = foldPl(query).trim();
  if (q.length < 2) return teams;
  return teams.filter((team) => {
    const name = foldPl(team.name);
    const official = foldPl(team.officialName ?? "");
    return name.includes(q) || official.includes(q);
  });
}
