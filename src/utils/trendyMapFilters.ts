import { PKEntry, Shot, TeamInfo, Action } from "@/types";
import { regainAttackZoneRawForMap } from "./kpiRegainLosesZoneRaw";
import { isRegainInOpponentHalfZone } from "./trendyKpis";
import { normalizeWiedzaPitchZone } from "./wiedzaZoneHeatmaps";

export type TrendyMapSide = "attack" | "defense";
export type TrendyMapSideFilter = TrendyMapSide | "all";

export function shotMatchesMapSideFilter(shot: Shot, side: TrendyMapSideFilter): boolean {
  if (side === "all") return true;
  return (shot.teamContext ?? "attack") === side;
}

export function filterShotsByMapSide<T extends Shot>(shots: T[], side: TrendyMapSideFilter): T[] {
  if (side === "all") return shots;
  return shots.filter((shot) => shotMatchesMapSideFilter(shot, side));
}

export type TrendyXgMapBodyPartFilter = "all" | "foot" | "foot_left" | "foot_right" | "head" | "other";

/** Wartość xG strzału do filtrów mapy (brak / NaN → 0). Legacy dane bywają stringiem ("0,12"). */
export function getShotXgForMapFilter(shot: Shot): number {
  const raw: unknown = shot.xG;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, raw);
  if (typeof raw === "string") {
    const parsed = Number.parseFloat(raw.replace(",", "."));
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return 0;
}

export function normalizeTrendyXgMapRange(
  xgMin: number | null,
  xgMax: number | null,
): { xgMin: number | null; xgMax: number | null } {
  if (xgMin !== null && xgMax !== null && xgMin > xgMax) {
    return { xgMin: xgMax, xgMax: xgMin };
  }
  return { xgMin, xgMax };
}

export function shotMatchesTrendyXgRange(
  shot: Shot,
  xgMin: number | null,
  xgMax: number | null,
): boolean {
  if (xgMin === null && xgMax === null) return true;
  const { xgMin: lo, xgMax: hi } = normalizeTrendyXgMapRange(xgMin, xgMax);
  const xg = getShotXgForMapFilter(shot);
  if (lo !== null && xg < lo) return false;
  if (hi !== null && xg > hi) return false;
  return true;
}

export function isTeamAttackShot(match: TeamInfo, shot: Shot): boolean {
  return getShotMapSide(match, shot) === "attack";
}

export function isTeamAttackPkEntry(match: TeamInfo, entry: PKEntry): boolean {
  return getPkEntryMapSide(match, entry) === "attack";
}

/** attack = nasze zdarzenia, defense = zdarzenia przeciwnika (z perspektywy dokumentu meczu). */
export function getShotMapSide(match: TeamInfo, shot: Shot): TrendyMapSide {
  if (shot.teamContext === "defense") return "defense";
  if (shot.teamContext === "attack") return "attack";
  if (shot.teamId && shot.teamId === match.opponent) return "defense";
  if (shot.teamId && shot.teamId === match.team) return "attack";
  return "attack";
}

/** PK zapisuje teamId = nasz zespół; strona wynika z teamContext (jak w Statystykach zespołu). */
export function getPkEntryMapSide(_match: TeamInfo, entry: PKEntry): TrendyMapSide {
  return (entry.teamContext ?? "attack") === "defense" ? "defense" : "attack";
}

export function collectMapShotsFromMatches(
  matches: TeamInfo[],
  side: TrendyMapSide | "both" = "both",
): Shot[] {
  const out: Shot[] = [];

  for (const match of matches) {
    const matchId = match.matchId ?? "";
    for (const shot of match.shots ?? []) {
      const shotSide = getShotMapSide(match, shot);
      if (side !== "both" && shotSide !== side) continue;
      out.push({
        ...shot,
        teamContext: shotSide,
        matchId: shot.matchId || matchId,
        id: shot.id || `${matchId}-shot-${shotSide}-${shot.minute}-${shot.x}-${shot.y}`,
      });
    }
  }

  return out;
}

export function collectMapPkEntriesFromMatches(
  matches: TeamInfo[],
  side: TrendyMapSide | "both" = "both",
): PKEntry[] {
  const out: PKEntry[] = [];

  for (const match of matches) {
    const matchId = match.matchId ?? "";
    for (const entry of match.pkEntries ?? []) {
      if (!entry) continue;
      const entrySide = getPkEntryMapSide(match, entry);
      if (side !== "both" && entrySide !== side) continue;
      out.push({
        ...entry,
        teamContext: entrySide,
        matchId: entry.matchId || matchId,
        id: entry.id || `${matchId}-pk-${entrySide}-${entry.minute}-${entry.startX}-${entry.startY}`,
      });
    }
  }

  return out;
}

/** @deprecated Użyj collectMapShotsFromMatches(matches, "attack") */
export function collectTeamAttackShotsFromMatches(matches: TeamInfo[]): Shot[] {
  return collectMapShotsFromMatches(matches, "attack");
}

/** @deprecated Użyj collectMapPkEntriesFromMatches(matches, "attack") */
export function collectTeamAttackPkEntriesFromMatches(matches: TeamInfo[]): PKEntry[] {
  return collectMapPkEntriesFromMatches(matches, "attack");
}

/** Przechwyty naszego zespołu na połowie przeciwnika — jak KPI regains_opp_half. */
export function isTeamRegainOnOpponentHalf(match: TeamInfo, action: Action): boolean {
  if (!action) return false;
  if (action.teamId && action.teamId !== match.team) return false;
  return isRegainInOpponentHalfZone(action);
}

/** Heatmapa stref ataku przechwytu (liczba akcji) dla KPI „Przechwyty na połowie przeciwnika”. */
export function buildRegainsOppHalfHeatmap(matches: TeamInfo[]): Map<string, number> {
  const result = new Map<string, number>();

  for (const match of matches) {
    for (const action of match.actions_regain ?? []) {
      if (!isTeamRegainOnOpponentHalf(match, action)) continue;
      const zoneName = normalizeWiedzaPitchZone(regainAttackZoneRawForMap(action));
      if (!zoneName) continue;
      result.set(zoneName, (result.get(zoneName) ?? 0) + 1);
    }
  }

  return result;
}

export function countRegainsOppHalfFromMatches(matches: TeamInfo[]): number {
  let total = 0;
  for (const match of matches) {
    for (const action of match.actions_regain ?? []) {
      if (isTeamRegainOnOpponentHalf(match, action)) total += 1;
    }
  }
  return total;
}
