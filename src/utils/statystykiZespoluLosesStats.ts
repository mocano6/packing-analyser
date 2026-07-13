import type { Action } from "@/types";
import { getOppositeXTValueForZone, getXTValueForZone, zoneNameToIndex } from "@/constants/xtValues";
import { losesZoneRawForMap } from "@/utils/kpiRegainLosesZoneRaw";
import {
  filterLosesActionsForTab,
  isLateralPitchZone,
  isOwnHalfByZoneColumn,
  losesMapZoneName,
  type RegainLosesContextMode,
  type RegainLosesHalfPitchFilter,
  type RegainLosesHeatmapMode,
  type RegainLosesPFilterKey,
  type RegainLosesPTileKey,
  REGAIN_LOSES_P_TILE_KEYS,
} from "@/utils/statystykiZespoluRegainLosesFilters";
import { normalizeWiedzaPitchZone } from "@/utils/wiedzaZoneHeatmaps";
import {
  summarizeLosesBypassedOpponents,
  type BypassedOpponentStats,
} from "@/utils/statystykiZespoluRegainLosesBypassed";

export type LosesMatchHalfFilter = "all" | "first" | "second";

export type LosesTeamStats = {
  visibleLosesCount: number;
  visibleAutCount: number;
  losesAttackCount: number;
  losesDefenseCount: number;
  losesXTInAttack: number;
  losesXTInDefense: number;
  totalLosesOwnHalfFull: number;
  totalLosesOpponentHalfFull: number;
  allLosesNoPCount: number;
  allLosesOwnHalfAutOnMapCount: number;
  bypassedOpponents: BypassedOpponentStats;
  pCounts: Record<RegainLosesPTileKey, { total: number; lateral: number; central: number }>;
};

export type LosesPlayerRow = {
  playerId: string;
  playerName: string;
  loses: number;
  losesSharePct: number;
  xtAttack: number;
  xtDefense: number;
  reaction5sCount: number;
  badReaction5sCount: number;
};

export type LosesTimelinePoint = {
  minute: string;
  loses: number;
  xtAttack: number;
  xtDefense: number;
};

function losesZoneRaw(action: Action): string | undefined {
  return losesZoneRawForMap(action);
}

function losesXtForZone(action: Action, zoneName: string): { attackXt: number; defenseXt: number } {
  const attackXt =
    action.losesAttackXT !== undefined
      ? action.losesAttackXT
      : (() => {
          const idx = zoneNameToIndex(zoneName);
          return idx !== null ? getXTValueForZone(idx) : (action.xTValueStart ?? action.xTValueEnd ?? 0);
        })();
  const defenseXt =
    action.losesDefenseXT !== undefined
      ? action.losesDefenseXT
      : (() => {
          const idx = zoneNameToIndex(zoneName);
          return idx !== null ? getOppositeXTValueForZone(idx) : 0;
        })();
  return { attackXt, defenseXt };
}

function halfPitchBase(actions: Action[], halfFilter: RegainLosesHalfPitchFilter): Action[] {
  return filterLosesActionsForTab(actions, halfFilter, []);
}

function countLosesPTiles(actions: Action[]): LosesTeamStats["pCounts"] {
  const counts = {
    p0: { total: 0, lateral: 0, central: 0 },
    p1: { total: 0, lateral: 0, central: 0 },
    p2: { total: 0, lateral: 0, central: 0 },
    p3: { total: 0, lateral: 0, central: 0 },
  } satisfies LosesTeamStats["pCounts"];

  for (const action of actions) {
    const attackZoneName = losesMapZoneName(action);
    if (!attackZoneName) continue;
    const zoneForHalf = normalizeWiedzaPitchZone(losesZoneRaw(action)) ?? attackZoneName;
    const excludeAsAut = isOwnHalfByZoneColumn(zoneForHalf) && (action.isAut === true || (action as Action & { aut?: boolean }).aut === true);
    if (excludeAsAut) continue;

    const lateral = isLateralPitchZone(attackZoneName);
    const key: RegainLosesPTileKey | null =
      action.isP0 || action.isP0Start ? "p0"
      : action.isP1 || action.isP1Start ? "p1"
      : action.isP2 || action.isP2Start ? "p2"
      : action.isP3 || action.isP3Start ? "p3"
      : null;
    if (!key) continue;
    counts[key].total += 1;
    if (lateral) counts[key].lateral += 1;
    else counts[key].central += 1;
  }
  return counts;
}

export function buildTeamLosesStats(
  allActions: Action[],
  halfPitchFilter: RegainLosesHalfPitchFilter,
  pFilters: RegainLosesPFilterKey[],
): LosesTeamStats {
  let totalLosesOwnHalfFull = 0;
  let totalLosesOpponentHalfFull = 0;
  for (const action of allActions) {
    const zoneName = normalizeWiedzaPitchZone(losesZoneRaw(action));
    if (!zoneName) continue;
    if (isOwnHalfByZoneColumn(zoneName)) {
      if (action.isAut !== true && (action as Action & { aut?: boolean }).aut !== true) {
        totalLosesOwnHalfFull += 1;
      }
    } else {
      totalLosesOpponentHalfFull += 1;
    }
  }

  const halfBase = halfPitchBase(allActions, halfPitchFilter);
  const pCounts = countLosesPTiles(halfBase);
  let allLosesNoPCount = 0;
  let allLosesOwnHalfAutOnMapCount = 0;

  for (const action of halfBase) {
    const attackZoneName = losesMapZoneName(action);
    if (!attackZoneName) continue;
    const zoneForHalf = normalizeWiedzaPitchZone(losesZoneRaw(action)) ?? attackZoneName;
    if (isOwnHalfByZoneColumn(zoneForHalf) && (action.isAut === true || (action as Action & { aut?: boolean }).aut === true)) {
      allLosesOwnHalfAutOnMapCount += 1;
      continue;
    }
    if (
      !action.isP0 && !action.isP0Start && !action.isP1 && !action.isP1Start
      && !action.isP2 && !action.isP2Start && !action.isP3 && !action.isP3Start
    ) {
      allLosesNoPCount += 1;
    }
  }

  const filtered = filterLosesActionsForTab(allActions, halfPitchFilter, pFilters);
  const visible = filtered.filter((a) => Boolean(losesMapZoneName(a)));
  const visibleAutCount = visible.filter(
    (a) => a.isAut === true || (a as Action & { aut?: boolean }).aut === true,
  ).length;

  let losesAttackCount = 0;
  let losesDefenseCount = 0;
  let losesXTInAttack = 0;
  let losesXTInDefense = 0;

  for (const action of filtered) {
    const zoneName = normalizeWiedzaPitchZone(losesZoneRaw(action));
    if (!zoneName) continue;
    if (isOwnHalfByZoneColumn(zoneName) && (action.isAut === true || (action as Action & { aut?: boolean }).aut === true)) {
      continue;
    }
    const { attackXt, defenseXt } = losesXtForZone(action, zoneName);
    // Każda strata ma obie wartości xT (strefa ataku i obrony) — jak w profilu zawodnika.
    losesAttackCount += 1;
    losesDefenseCount += 1;
    losesXTInAttack += attackXt;
    losesXTInDefense += defenseXt;
  }

  const bypassedOpponents = summarizeLosesBypassedOpponents(filtered);
  return {
    visibleLosesCount: visible.length,
    visibleAutCount,
    losesAttackCount,
    losesDefenseCount,
    losesXTInAttack,
    losesXTInDefense,
    totalLosesOwnHalfFull,
    totalLosesOpponentHalfFull,
    allLosesNoPCount,
    allLosesOwnHalfAutOnMapCount,
    bypassedOpponents,
    pCounts,
  };
}

export function buildLosesHeatmapData(
  actions: Action[],
  halfPitchFilter: RegainLosesHalfPitchFilter,
  pFilters: RegainLosesPFilterKey[],
  contextMode: RegainLosesContextMode,
  heatmapMode: RegainLosesHeatmapMode,
): Map<string, number> {
  const filtered = filterLosesActionsForTab(actions, halfPitchFilter, pFilters);
  const result = new Map<string, number>();
  for (const action of filtered) {
    const zoneName = losesMapZoneName(action);
    if (!zoneName) continue;
    const add = heatmapMode === "count"
      ? 1
      : contextMode === "attack"
        ? (action.losesAttackXT ?? 0)
        : (action.losesDefenseXT ?? 0);
    result.set(zoneName, (result.get(zoneName) ?? 0) + add);
  }
  return result;
}

export function buildLosesTimelineXT(actions: Action[]): LosesTimelinePoint[] {
  const intervals: Record<number, { loses: number; xtAttack: number; xtDefense: number }> = {};
  for (const action of actions) {
    const minute = typeof action.minute === "number" ? action.minute : Number(action.minute);
    if (!Number.isFinite(minute)) continue;
    const interval = Math.floor(minute / 5) * 5;
    if (!intervals[interval]) intervals[interval] = { loses: 0, xtAttack: 0, xtDefense: 0 };
    const zoneName = normalizeWiedzaPitchZone(losesZoneRaw(action));
    if (!zoneName) continue;
    const { attackXt, defenseXt } = losesXtForZone(action, zoneName);
    intervals[interval].loses += 1;
    intervals[interval].xtAttack += attackXt;
    intervals[interval].xtDefense += defenseXt;
  }
  const data: LosesTimelinePoint[] = [];
  for (let i = 0; i <= 90; i += 5) {
    const row = intervals[i] ?? { loses: 0, xtAttack: 0, xtDefense: 0 };
    data.push({ minute: `${i}-${i + 5}`, ...row });
  }
  return data;
}

export function buildTotalLosesXT(actions: Action[]): { totalXTInAttack: number; totalXTInDefense: number; totalXT: number } {
  let totalXTInAttack = 0;
  let totalXTInDefense = 0;
  for (const action of actions) {
    const zoneName = normalizeWiedzaPitchZone(losesZoneRaw(action));
    if (!zoneName) continue;
    const { attackXt, defenseXt } = losesXtForZone(action, zoneName);
    totalXTInAttack += attackXt;
    totalXTInDefense += defenseXt;
  }
  return { totalXTInAttack, totalXTInDefense, totalXT: totalXTInAttack + totalXTInDefense };
}

export function buildLosesPlayerRows(
  actions: Action[],
  totalLoses: number,
  labelFor: (playerId: string) => string,
): LosesPlayerRow[] {
  const map = new Map<string, LosesPlayerRow>();
  for (const action of actions) {
    const playerId = action.senderId;
    if (!playerId) continue;
    if (!map.has(playerId)) {
      map.set(playerId, {
        playerId,
        playerName: labelFor(playerId),
        loses: 0,
        losesSharePct: 0,
        xtAttack: 0,
        xtDefense: 0,
        reaction5sCount: 0,
        badReaction5sCount: 0,
      });
    }
    const row = map.get(playerId)!;
    row.loses += 1;
    const zoneName = normalizeWiedzaPitchZone(losesZoneRaw(action));
    if (zoneName) {
      const { attackXt, defenseXt } = losesXtForZone(action, zoneName);
      row.xtAttack += attackXt;
      row.xtDefense += defenseXt;
    }
    if (action.isReaction5s === true) row.reaction5sCount += 1;
    if (action.isBadReaction5s === true || (action as Action & { isReaction5sNotApplicable?: boolean }).isReaction5sNotApplicable === true) {
      row.badReaction5sCount += 1;
    }
  }
  return Array.from(map.values())
    .map((r) => ({
      ...r,
      losesSharePct: totalLoses > 0 ? (r.loses / totalLoses) * 100 : 0,
    }))
    .sort((a, b) => b.loses - a.loses || b.xtAttack - a.xtAttack);
}

export function getLosesXtValues(action: Action): { attackXt: number; defenseXt: number } {
  const zoneName = losesMapZoneName(action);
  if (!zoneName) return { attackXt: 0, defenseXt: 0 };
  return losesXtForZone(action, zoneName);
}

export function isLoseAttackContext(action: Action): boolean {
  const zoneName = losesMapZoneName(action);
  return zoneName ? !isOwnHalfByZoneColumn(zoneName) : false;
}

export type LosesZoneContextActionGroup = {
  context: RegainLosesContextMode;
  label: string;
  actions: Action[];
};

export function getLosesActionsInZone(
  actions: Action[],
  zoneName: string,
  halfPitchFilter: RegainLosesHalfPitchFilter,
  pFilters: RegainLosesPFilterKey[],
): Action[] {
  const target = normalizeWiedzaPitchZone(zoneName) ?? zoneName.toUpperCase().replace(/\s+/g, "");
  return filterLosesActionsForTab(actions, halfPitchFilter, pFilters).filter(
    (a) => losesMapZoneName(a) === target,
  );
}

export function buildLosesZoneContextActionGroups(
  actions: Action[],
  zoneName: string,
  halfPitchFilter: RegainLosesHalfPitchFilter,
  pFilters: RegainLosesPFilterKey[],
): LosesZoneContextActionGroup[] {
  const inZone = getLosesActionsInZone(actions, zoneName, halfPitchFilter, pFilters);
  const sortActions = (rows: Action[]) =>
    [...rows].sort((a, b) => a.minute - b.minute || a.id.localeCompare(b.id));

  return [
    {
      context: "attack",
      label: "W ataku",
      actions: sortActions(inZone.filter(isLoseAttackContext)),
    },
    {
      context: "defense",
      label: "W obronie",
      actions: sortActions(inZone.filter((a) => !isLoseAttackContext(a))),
    },
  ];
}

export function filterLosesByMatchHalf(actions: Action[], half: LosesMatchHalfFilter): Action[] {
  if (half === "all") return actions;
  if (half === "first") return actions.filter((a) => !a.isSecondHalf);
  return actions.filter((a) => a.isSecondHalf);
}

export { REGAIN_LOSES_P_TILE_KEYS };
