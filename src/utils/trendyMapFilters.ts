import { PKEntry, Shot, TeamInfo, Action } from "@/types";
import { regainAttackZoneRawForMap } from "./kpiRegainLosesZoneRaw";
import { isRegainInOpponentHalfZone } from "./trendyKpis";
import { normalizeWiedzaPitchZone } from "./wiedzaZoneHeatmaps";

export type TrendyMapSide = "attack" | "defense";

export type TrendyXgMapBodyPartFilter = "all" | "foot" | "foot_left" | "foot_right" | "head" | "other";

export type TrendyXgMapFilters = {
  bodyPart: TrendyXgMapBodyPartFilter;
  sfg: boolean;
  counter: boolean;
  regain: boolean;
  goal: boolean;
  blocked: boolean;
  onTarget: boolean;
  /** Dolna granica xG (włącznie); null = bez dolnego limitu. */
  xgMin: number | null;
  /** Górna granica xG (włącznie); null = bez górnego limitu. */
  xgMax: number | null;
};

export type TrendyPkEntryTypeFilter = "all" | "pass" | "dribble" | "sfg";

export type TrendyPkMapFilters = {
  entryType: TrendyPkEntryTypeFilter;
  onlyRegain: boolean;
  onlyShot: boolean;
  onlyGoal: boolean;
};

export const DEFAULT_TRENDY_XG_MAP_FILTERS: TrendyXgMapFilters = {
  bodyPart: "all",
  sfg: true,
  counter: true,
  regain: true,
  goal: true,
  blocked: true,
  onTarget: true,
  xgMin: null,
  xgMax: null,
};

/** Wartość xG strzału do filtrów mapy (brak / NaN → 0). */
export function getShotXgForMapFilter(shot: Shot): number {
  const raw = shot.xG;
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

export const DEFAULT_TRENDY_PK_MAP_FILTERS: TrendyPkMapFilters = {
  entryType: "all",
  onlyRegain: false,
  onlyShot: false,
  onlyGoal: false,
};

const SET_PIECE_ACTION_TYPES = new Set([
  "corner",
  "free_kick",
  "direct_free_kick",
  "penalty",
  "throw_in",
]);

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

function isShotSetPiece(shot: Shot): boolean {
  return (
    (shot as { actionCategory?: string }).actionCategory === "sfg" ||
    Boolean(shot.actionType && SET_PIECE_ACTION_TYPES.has(shot.actionType))
  );
}

function isShotCounter(shot: Shot): boolean {
  return shot.actionType === "counter";
}

/** Filtr mapy strzałów — ta sama logika co Statystyki zespołu + filtr kontry. */
export function filterShotsForTrendyMap(shots: Shot[], filters: TrendyXgMapFilters): Shot[] {
  return shots.filter((shot) => {
    if (!shotMatchesTrendyXgRange(shot, filters.xgMin, filters.xgMax)) {
      return false;
    }

    if (filters.bodyPart !== "all") {
      const bodyPart = filters.bodyPart;
      const shotBodyPart = shot.bodyPart;
      if (bodyPart === "foot") {
        if (shotBodyPart !== "foot" && shotBodyPart !== "foot_left" && shotBodyPart !== "foot_right") {
          return false;
        }
      } else if (shotBodyPart !== bodyPart) {
        return false;
      }
    }

    const allTypeFiltersOff =
      !filters.sfg &&
      !filters.counter &&
      !filters.regain &&
      !filters.goal &&
      !filters.blocked &&
      !filters.onTarget;

    if (allTypeFiltersOff) return true;

    let matchesAnyFilter = false;

    if (filters.sfg && isShotSetPiece(shot)) {
      matchesAnyFilter = true;
    }

    if (filters.counter && isShotCounter(shot)) {
      matchesAnyFilter = true;
    }

    if (filters.regain && shot.actionType === "regain") {
      matchesAnyFilter = true;
    }

    if (filters.goal && shot.isGoal) {
      matchesAnyFilter = true;
    }

    if (filters.blocked && shot.shotType === "blocked") {
      matchesAnyFilter = true;
    }

    if (filters.onTarget && (shot.shotType === "on_target" || shot.shotType === "goal")) {
      matchesAnyFilter = true;
    }

    if (!matchesAnyFilter) {
      const isOffTarget = shot.shotType === "off_target";
      const isOpenPlay = shot.actionType === "open_play";
      const isOtherType = isOffTarget || (isOpenPlay && shot.actionType !== "regain");
      if (isOtherType && allTypeFiltersOff) return true;
      return false;
    }

    return true;
  });
}

/** Filtr mapy wejść w PK — jak Statystyki zespołu (typ + flagi wyniku). */
export function filterPkEntriesForTrendyMap(entries: PKEntry[], filters: TrendyPkMapFilters): PKEntry[] {
  return entries.filter((entry) => {
    if (filters.entryType !== "all" && (entry.entryType || "pass") !== filters.entryType) {
      return false;
    }
    if (filters.onlyRegain && !entry.isRegain) return false;
    if (filters.onlyShot && !entry.isShot) return false;
    if (filters.onlyGoal && !entry.isGoal) return false;
    return true;
  });
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
