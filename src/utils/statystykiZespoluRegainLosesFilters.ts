import type { Action } from "@/types";
import { normalizeWiedzaPitchZone } from "@/utils/wiedzaZoneHeatmaps";
import { getOppositeXTValueForZone, zoneNameToIndex } from "@/constants/xtValues";
import {
  regainAttackZoneRawForMap,
  losesZoneRawForMap,
} from "@/utils/kpiRegainLosesZoneRaw";

export type RegainLosesHalfPitchFilter = "all" | "own" | "opponent" | "pm";
export type RegainLosesHeatmapMode = "xt" | "count";
export type RegainLosesContextMode = "attack" | "defense";

export type RegainLosesPFilterKey =
  | "p0"
  | "p1"
  | "p2"
  | "p3"
  | "p0start"
  | "p1start"
  | "p2start"
  | "p3start"
  | "pk"
  | "shot"
  | "goal";

export const REGAIN_LOSES_P_TILE_KEYS = ["p0", "p1", "p2", "p3"] as const;
export type RegainLosesPTileKey = (typeof REGAIN_LOSES_P_TILE_KEYS)[number];

const PM_ZONE_NAMES = new Set([
  "C5", "C6", "C7", "C8", "D5", "D6", "D7", "D8",
  "E5", "E6", "E7", "E8", "F5", "F6", "F7", "F8",
]);

export function isLateralPitchZone(zoneName: string | null | undefined): boolean {
  if (!zoneName) return false;
  const normalized = normalizeWiedzaPitchZone(zoneName);
  if (!normalized) return false;
  const letter = normalized.charAt(0);
  return letter === "A" || letter === "B" || letter === "G" || letter === "H";
}

export function isOwnHalfByZoneColumn(zoneName: string | null | undefined): boolean {
  const normalized = normalizeWiedzaPitchZone(zoneName);
  if (!normalized) return false;
  const col = Number.parseInt(normalized.slice(1), 10);
  if (!Number.isFinite(col)) return false;
  return col <= 6;
}

export function isPmPitchZone(zoneName: string | null | undefined): boolean {
  const normalized = normalizeWiedzaPitchZone(zoneName);
  return normalized ? PM_ZONE_NAMES.has(normalized) : false;
}

export function matchesRegainLosesPFilter(
  action: Action,
  filters: RegainLosesPFilterKey[],
): boolean {
  if (filters.length === 0) return true;

  const startFilters = filters.filter((f) =>
    ["p0start", "p1start", "p2start", "p3start"].includes(f),
  );
  const endFilters = filters.filter((f) =>
    ["p0", "p1", "p2", "p3", "pk", "shot", "goal"].includes(f),
  );

  let matchesStart = startFilters.length === 0;
  let matchesEnd = endFilters.length === 0;

  if (startFilters.length > 0) {
    matchesStart = startFilters.some((filter) => {
      if (filter === "p0start") return action.isP0Start;
      if (filter === "p1start") return action.isP1Start;
      if (filter === "p2start") return action.isP2Start;
      if (filter === "p3start") return action.isP3Start;
      return false;
    });
  }

  if (endFilters.length > 0) {
    matchesEnd = endFilters.some((filter) => {
      if (filter === "p0") return action.isP0;
      if (filter === "p1") return action.isP1;
      if (filter === "p2") return action.isP2;
      if (filter === "p3") return action.isP3;
      if (filter === "pk") return action.isPenaltyAreaEntry;
      if (filter === "shot") return action.isShot;
      if (filter === "goal") return action.isGoal;
      return false;
    });
  }

  return matchesStart && matchesEnd;
}

export function toggleRegainLosesPFilter(
  current: RegainLosesPFilterKey[],
  key: RegainLosesPTileKey,
): RegainLosesPFilterKey[] {
  const endKeys: RegainLosesPFilterKey[] = ["p0", "p1", "p2", "p3", "pk", "shot", "goal"];
  const withoutEnd = current.filter((f) => !endKeys.includes(f));
  if (current.includes(key)) return withoutEnd;
  return [...withoutEnd, key];
}

function zonePassesHalfFilter(
  zoneName: string | null | undefined,
  halfFilter: RegainLosesHalfPitchFilter,
): boolean {
  if (halfFilter === "all") return true;
  if (!zoneName) return false;
  if (halfFilter === "pm") return isPmPitchZone(zoneName);
  const isOwn = isOwnHalfByZoneColumn(zoneName);
  return halfFilter === "own" ? isOwn : !isOwn;
}

export function filterRegainActionsForTab(
  actions: Action[],
  halfFilter: RegainLosesHalfPitchFilter,
  pFilters: RegainLosesPFilterKey[],
): Action[] {
  let filtered = actions.filter((action) => {
    const zoneRaw = regainAttackZoneRawForMap(action);
    const zoneName = zoneRaw ? normalizeWiedzaPitchZone(zoneRaw) : null;
    return zonePassesHalfFilter(zoneName, halfFilter);
  });
  if (pFilters.length > 0) {
    filtered = filtered.filter((a) => matchesRegainLosesPFilter(a, pFilters));
  }
  return filtered;
}

export function filterLosesActionsForTab(
  actions: Action[],
  halfFilter: RegainLosesHalfPitchFilter,
  pFilters: RegainLosesPFilterKey[],
): Action[] {
  let filtered = actions.filter((action) => {
    const zoneRaw = losesZoneRawForMap(action);
    const zoneName = zoneRaw ? normalizeWiedzaPitchZone(zoneRaw) : null;
    return zonePassesHalfFilter(zoneName, halfFilter);
  });
  if (pFilters.length > 0) {
    filtered = filtered.filter((a) => matchesRegainLosesPFilter(a, pFilters));
  }
  return filtered;
}

export function regainMapZoneName(action: Action): string | null {
  const raw = regainAttackZoneRawForMap(action);
  return raw ? normalizeWiedzaPitchZone(raw) : null;
}

export function losesMapZoneName(action: Action): string | null {
  const raw = action.losesAttackZone || action.oppositeZone;
  return raw ? normalizeWiedzaPitchZone(raw) : null;
}

export function regainDefenseZoneName(action: Action): string | null {
  const raw = action.regainDefenseZone || action.fromZone || action.toZone || action.startZone;
  return raw ? normalizeWiedzaPitchZone(raw) : null;
}

export function regainXtValues(action: Action): { attackXt: number; defenseXt: number } {
  const defenseZoneName = regainDefenseZoneName(action);
  const defenseXt =
    action.regainDefenseXT !== undefined
      ? action.regainDefenseXT
      : (action.xTValueEnd ?? action.xTValueStart ?? 0);
  const attackXt =
    action.regainAttackXT !== undefined
      ? action.regainAttackXT
      : (action.oppositeXT ??
        (defenseZoneName && zoneNameToIndex(defenseZoneName) !== null
          ? getOppositeXTValueForZone(zoneNameToIndex(defenseZoneName)!)
          : 0));
  return { attackXt, defenseXt };
}
