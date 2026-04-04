import { Action, TeamInfo } from "../types";
import { zoneNameToIndex } from "../constants/xtValues";

export type WiedzaHeatmapHalfFilter = "all" | "own" | "opponent" | "pm";
export type WiedzaHeatmapMode = "count" | "xt";
export type WiedzaHeatmapXtSide = "attack" | "defense";

/** Kanoniczna nazwa strefy siatki (np. D6) — do heatmap i tabel stref. */
export function normalizeWiedzaPitchZone(zone: string | number | null | undefined): string | null {
  if (zone == null || zone === "") return null;
  return typeof zone === "string"
    ? zone.toUpperCase().replace(/\s+/g, "")
    : String(zone).toUpperCase().replace(/\s+/g, "");
}

function convertZoneToName(zone: string | number | null | undefined): string | null {
  return normalizeWiedzaPitchZone(zone);
}

function isOwnHalf(zoneName: string | null | undefined): boolean {
  if (!zoneName) return false;
  const normalized = convertZoneToName(zoneName);
  if (!normalized) return false;
  const zoneIndex = zoneNameToIndex(normalized);
  if (zoneIndex === null) return false;
  return zoneIndex % 12 <= 5;
}

const PM_ZONE_NAMES = new Set([
  "C5",
  "C6",
  "C7",
  "C8",
  "D5",
  "D6",
  "D7",
  "D8",
  "E5",
  "E6",
  "E7",
  "E8",
  "F5",
  "F6",
  "F7",
  "F8",
]);

function isPMArea(zoneName: string | null | undefined): boolean {
  if (!zoneName) return false;
  const normalized = convertZoneToName(zoneName);
  if (!normalized) return false;
  return PM_ZONE_NAMES.has(normalized);
}

/** Przechwyty naszego zespołu z dokumentów meczów (Baza wiedzy). */
export function collectRegainActionsFromWiedzaMatches(matches: TeamInfo[]): Action[] {
  const out: Action[] = [];
  for (const m of matches) {
    for (const a of m.actions_regain ?? []) {
      if (!a) continue;
      if (a.teamId && a.teamId !== m.team) continue;
      out.push(a);
    }
  }
  return out;
}

/** Straty naszego zespołu (bez autów). */
export function collectLosesActionsFromWiedzaMatches(matches: TeamInfo[]): Action[] {
  const out: Action[] = [];
  for (const m of matches) {
    for (const a of m.actions_loses ?? []) {
      if (!a || a.isAut === true) continue;
      if (a.teamId && a.teamId !== m.team) continue;
      out.push(a);
    }
  }
  return out;
}

function filterRegainsByHalf(actions: Action[], half: WiedzaHeatmapHalfFilter): Action[] {
  if (half === "all") return actions;
  if (half === "pm") {
    return actions.filter((action) => {
      const attackZoneRaw = action.regainAttackZone || action.oppositeZone || action.toZone || action.endZone;
      const attackZoneName = attackZoneRaw ? convertZoneToName(String(attackZoneRaw)) : null;
      return isPMArea(attackZoneName);
    });
  }
  return actions.filter((action) => {
    const defenseZoneRaw = action.regainDefenseZone || action.fromZone || action.toZone || action.startZone;
    const defenseZoneName = defenseZoneRaw ? convertZoneToName(String(defenseZoneRaw)) : null;
    if (!defenseZoneName) return false;
    const own = isOwnHalf(defenseZoneName);
    return half === "own" ? !own : own;
  });
}

function filterLosesByHalf(actions: Action[], half: WiedzaHeatmapHalfFilter): Action[] {
  if (half === "all") return actions;
  if (half === "pm") {
    return actions.filter((action) => {
      const losesZoneRaw = action.losesAttackZone || action.fromZone || action.toZone || action.startZone;
      const losesZoneName = losesZoneRaw ? convertZoneToName(String(losesZoneRaw)) : null;
      return isPMArea(losesZoneName);
    });
  }
  return actions.filter((action) => {
    const losesZoneRaw = action.losesAttackZone || action.fromZone || action.toZone || action.startZone;
    const losesZoneName = losesZoneRaw ? convertZoneToName(String(losesZoneRaw)) : null;
    if (!losesZoneName) return false;
    const own = isOwnHalf(losesZoneName);
    return half === "own" ? own : !own;
  });
}

/**
 * Agregacja przechwytów ze wszystkich meczów próby — klucz strefy jak w Statystykach zespołu (regainAttackZone).
 * Filtr połowy jak na stronie zespołu (własna / przeciwnika / PM / wszystkie).
 */
export function buildAggregatedRegainZoneHeatmap(
  matches: TeamInfo[],
  half: WiedzaHeatmapHalfFilter,
  mode: WiedzaHeatmapMode,
  xtSide: WiedzaHeatmapXtSide,
): Map<string, number> {
  const actions = filterRegainsByHalf(collectRegainActionsFromWiedzaMatches(matches), half);
  const result = new Map<string, number>();

  for (const action of actions) {
    const attackZoneRaw = action.regainAttackZone || action.oppositeZone;
    const attackZoneName = attackZoneRaw ? convertZoneToName(String(attackZoneRaw)) : null;
    if (!attackZoneName) continue;

    if (mode === "xt") {
      const actionXT =
        xtSide === "attack" ? Number(action.regainAttackXT ?? 0) : Number(action.regainDefenseXT ?? 0);
      result.set(attackZoneName, (result.get(attackZoneName) ?? 0) + actionXT);
    } else {
      result.set(attackZoneName, (result.get(attackZoneName) ?? 0) + 1);
    }
  }

  return result;
}

/**
 * Agregacja strat — strefa ataku straty (losesAttackZone), perspektywa naszego zespołu.
 */
export function buildAggregatedLosesZoneHeatmap(
  matches: TeamInfo[],
  half: WiedzaHeatmapHalfFilter,
  mode: WiedzaHeatmapMode,
  xtSide: WiedzaHeatmapXtSide,
): Map<string, number> {
  const actions = filterLosesByHalf(collectLosesActionsFromWiedzaMatches(matches), half);
  const result = new Map<string, number>();

  for (const action of actions) {
    const attackZoneRaw = action.losesAttackZone || action.oppositeZone;
    const attackZoneName = attackZoneRaw ? convertZoneToName(String(attackZoneRaw)) : null;
    if (!attackZoneName) continue;

    if (mode === "xt") {
      const actionXT =
        xtSide === "attack" ? Number(action.losesAttackXT ?? 0) : Number(action.losesDefenseXT ?? 0);
      result.set(attackZoneName, (result.get(attackZoneName) ?? 0) + actionXT);
    } else {
      result.set(attackZoneName, (result.get(attackZoneName) ?? 0) + 1);
    }
  }

  return result;
}
