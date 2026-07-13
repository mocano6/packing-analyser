import type { Action } from "@/types";
import {
  filterRegainActionsForTab,
  isLateralPitchZone,
  isOwnHalfByZoneColumn,
  regainMapZoneName,
  regainXtValues,
  type RegainLosesContextMode,
  type RegainLosesHalfPitchFilter,
  type RegainLosesHeatmapMode,
  type RegainLosesPFilterKey,
  type RegainLosesPTileKey,
  REGAIN_LOSES_P_TILE_KEYS,
} from "@/utils/statystykiZespoluRegainLosesFilters";
import { normalizeWiedzaPitchZone } from "@/utils/wiedzaZoneHeatmaps";
import {
  summarizeRegainBypassedOpponents,
  type BypassedOpponentStats,
} from "@/utils/statystykiZespoluRegainLosesBypassed";

export type RegainMatchHalfFilter = "all" | "first" | "second";

export type RegainTeamStats = {
  totalRegains: number;
  visibleRegainsCount: number;
  visibleRegainsOpponentHalf: number;
  regainAttackCount: number;
  regainDefenseCount: number;
  regainXTInAttack: number;
  regainXTInDefense: number;
  attackPct: number;
  defensePct: number;
  allRegainNoPCount: number;
  bypassedOpponents: BypassedOpponentStats;
  pCounts: Record<RegainLosesPTileKey, { total: number; lateral: number; central: number }>;
};

export type RegainPlayerRow = {
  playerId: string;
  playerName: string;
  regains: number;
  regainSharePct: number;
  xtAttack: number;
  xtDefense: number;
  p2Count: number;
  p3Count: number;
};

export type RegainTimelinePoint = {
  minute: string;
  regains: number;
  xtAttack: number;
  xtDefense: number;
};

function halfPitchFiltered(
  actions: Action[],
  halfFilter: RegainLosesHalfPitchFilter,
): Action[] {
  return filterRegainActionsForTab(actions, halfFilter, []);
}

function countPTiles(actions: Action[]): RegainTeamStats["pCounts"] {
  const counts = {
    p0: { total: 0, lateral: 0, central: 0 },
    p1: { total: 0, lateral: 0, central: 0 },
    p2: { total: 0, lateral: 0, central: 0 },
    p3: { total: 0, lateral: 0, central: 0 },
  } satisfies RegainTeamStats["pCounts"];

  for (const action of actions) {
    const zoneName = regainMapZoneName(action);
    if (!zoneName) continue;
    const lateral = isLateralPitchZone(zoneName);
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

export function buildTeamRegainStats(
  allActions: Action[],
  halfPitchFilter: RegainLosesHalfPitchFilter,
  pFilters: RegainLosesPFilterKey[],
): RegainTeamStats {
  const halfBase = halfPitchFiltered(allActions, halfPitchFilter);
  const pCounts = countPTiles(halfBase);
  let allRegainNoPCount = 0;
  for (const action of halfBase) {
    if (!regainMapZoneName(action)) continue;
    if (
      !action.isP0 && !action.isP0Start && !action.isP1 && !action.isP1Start
      && !action.isP2 && !action.isP2Start && !action.isP3 && !action.isP3Start
    ) {
      allRegainNoPCount += 1;
    }
  }

  const filtered = filterRegainActionsForTab(allActions, halfPitchFilter, pFilters);
  const visible = filtered.filter((a) => Boolean(regainMapZoneName(a)));

  let regainAttackCount = 0;
  let regainDefenseCount = 0;
  let regainXTInAttack = 0;
  let regainXTInDefense = 0;
  let visibleRegainsOpponentHalf = 0;

  for (const action of filtered) {
    const mapZone = regainMapZoneName(action);
    if (mapZone && !isOwnHalfByZoneColumn(mapZone)) visibleRegainsOpponentHalf += 1;

    const { attackXt, defenseXt } = regainXtValues(action);
    // Każdy przechwyt ma obie wartości xT (strefa ataku i obrony) — jak w profilu zawodnika.
    regainAttackCount += 1;
    regainDefenseCount += 1;
    regainXTInAttack += attackXt;
    regainXTInDefense += defenseXt;
  }

  const total = filtered.length;
  const bypassedOpponents = summarizeRegainBypassedOpponents(filtered);
  return {
    totalRegains: total,
    visibleRegainsCount: visible.length,
    visibleRegainsOpponentHalf,
    regainAttackCount,
    regainDefenseCount,
    regainXTInAttack,
    regainXTInDefense,
    attackPct: total > 0 ? (regainAttackCount / total) * 100 : 0,
    defensePct: total > 0 ? (regainDefenseCount / total) * 100 : 0,
    allRegainNoPCount,
    bypassedOpponents,
    pCounts,
  };
}

export function buildRegainHeatmapData(
  actions: Action[],
  halfPitchFilter: RegainLosesHalfPitchFilter,
  pFilters: RegainLosesPFilterKey[],
  contextMode: RegainLosesContextMode,
  heatmapMode: RegainLosesHeatmapMode,
): Map<string, number> {
  const filtered = filterRegainActionsForTab(actions, halfPitchFilter, pFilters);
  const result = new Map<string, number>();
  for (const action of filtered) {
    const zoneName = regainMapZoneName(action);
    if (!zoneName) continue;
    const { attackXt, defenseXt } = regainXtValues(action);
    const add = heatmapMode === "count"
      ? 1
      : contextMode === "attack" ? attackXt : defenseXt;
    result.set(zoneName, (result.get(zoneName) ?? 0) + add);
  }
  return result;
}

export function buildRegainTimelineXT(actions: Action[]): RegainTimelinePoint[] {
  const intervals: Record<number, { regains: number; xtAttack: number; xtDefense: number }> = {};
  for (const action of actions) {
    const minute = typeof action.minute === "number" ? action.minute : Number(action.minute);
    if (!Number.isFinite(minute)) continue;
    const interval = Math.floor(minute / 5) * 5;
    if (!intervals[interval]) intervals[interval] = { regains: 0, xtAttack: 0, xtDefense: 0 };
    const { attackXt, defenseXt } = regainXtValues(action);
    intervals[interval].regains += 1;
    intervals[interval].xtAttack += attackXt;
    intervals[interval].xtDefense += defenseXt;
  }
  const data: RegainTimelinePoint[] = [];
  for (let i = 0; i <= 90; i += 5) {
    const row = intervals[i] ?? { regains: 0, xtAttack: 0, xtDefense: 0 };
    data.push({ minute: `${i}-${i + 5}`, ...row });
  }
  return data;
}

export function buildTotalRegainsXT(actions: Action[]): { totalXTInAttack: number; totalXTInDefense: number; totalXT: number } {
  let totalXTInAttack = 0;
  let totalXTInDefense = 0;
  for (const action of actions) {
    const { attackXt, defenseXt } = regainXtValues(action);
    totalXTInAttack += attackXt;
    totalXTInDefense += defenseXt;
  }
  return { totalXTInAttack, totalXTInDefense, totalXT: totalXTInAttack + totalXTInDefense };
}

export function buildRegainPlayerRows(
  actions: Action[],
  totalRegains: number,
  labelFor: (playerId: string) => string,
): RegainPlayerRow[] {
  const map = new Map<string, RegainPlayerRow>();
  for (const action of actions) {
    const playerId = action.senderId;
    if (!playerId) continue;
    if (!map.has(playerId)) {
      map.set(playerId, {
        playerId,
        playerName: labelFor(playerId),
        regains: 0,
        regainSharePct: 0,
        xtAttack: 0,
        xtDefense: 0,
        p2Count: 0,
        p3Count: 0,
      });
    }
    const row = map.get(playerId)!;
    row.regains += 1;
    const { attackXt, defenseXt } = regainXtValues(action);
    row.xtAttack += attackXt;
    row.xtDefense += defenseXt;
    if (action.isP2 || action.isP2Start) row.p2Count += 1;
    if (action.isP3 || action.isP3Start) row.p3Count += 1;
  }
  return Array.from(map.values())
    .map((r) => ({
      ...r,
      regainSharePct: totalRegains > 0 ? (r.regains / totalRegains) * 100 : 0,
    }))
    .sort((a, b) => b.regains - a.regains || b.xtAttack - a.xtAttack);
}

export function isRegainAttackContext(action: Action): boolean {
  const { defenseXt } = regainXtValues(action);
  return action.isAttack !== undefined ? action.isAttack : defenseXt < 0.02;
}

export type RegainZoneContextActionGroup = {
  context: RegainLosesContextMode;
  label: string;
  actions: Action[];
};

export function getRegainActionsInZone(
  actions: Action[],
  zoneName: string,
  halfPitchFilter: RegainLosesHalfPitchFilter,
  pFilters: RegainLosesPFilterKey[],
): Action[] {
  const target = normalizeWiedzaPitchZone(zoneName) ?? zoneName.toUpperCase().replace(/\s+/g, "");
  return filterRegainActionsForTab(actions, halfPitchFilter, pFilters).filter(
    (a) => regainMapZoneName(a) === target,
  );
}

export function buildRegainZoneContextActionGroups(
  actions: Action[],
  zoneName: string,
  halfPitchFilter: RegainLosesHalfPitchFilter,
  pFilters: RegainLosesPFilterKey[],
): RegainZoneContextActionGroup[] {
  const inZone = getRegainActionsInZone(actions, zoneName, halfPitchFilter, pFilters);
  const sortActions = (rows: Action[]) =>
    [...rows].sort((a, b) => a.minute - b.minute || a.id.localeCompare(b.id));

  return [
    {
      context: "attack",
      label: "W ataku",
      actions: sortActions(inZone.filter(isRegainAttackContext)),
    },
    {
      context: "defense",
      label: "W obronie",
      actions: sortActions(inZone.filter((a) => !isRegainAttackContext(a))),
    },
  ];
}

export function filterRegainByMatchHalf(actions: Action[], half: RegainMatchHalfFilter): Action[] {
  if (half === "all") return actions;
  if (half === "first") return actions.filter((a) => !a.isSecondHalf);
  return actions.filter((a) => a.isSecondHalf);
}

export { REGAIN_LOSES_P_TILE_KEYS };
