import type { Action } from "@/types";
import { zoneNameToIndex } from "@/constants/xtValues";
import { normalizeWiedzaPitchZone } from "./wiedzaZoneHeatmaps";

/** Strefa ataku przechwytu do mapy / liczników — jak w statystykach zespołu (fallback toZone/endZone). */
export function regainAttackZoneRawForMap(action: Action): string | undefined {
  return (
    action.regainAttackZone ||
    action.oppositeZone ||
    action.toZone ||
    action.endZone ||
    undefined
  );
}

/** Strefa straty do mapy / liczników — jak w statystykach zespołu (from/to/start). */
export function losesAttackZoneRawForMap(action: Action): string | undefined {
  return (
    action.losesAttackZone ||
    action.fromZone ||
    action.toZone ||
    action.startZone ||
    undefined
  );
}

/** Strefa straty z fallbackiem losesDefenseZone — jak liczniki/heatmapy w Statystykach zespołu. */
export function losesZoneRawForMap(action: Action): string | undefined {
  return (
    action.losesAttackZone ||
    action.fromZone ||
    action.toZone ||
    action.startZone ||
    action.losesDefenseZone ||
    undefined
  );
}

/** Kolumny 1–6 siatki = własna połowa, 7–12 = połowa przeciwnika (jak Statystyki zespołu / heatmapy). */
export function isOwnHalfZoneForMap(zoneName: string | undefined): boolean {
  const normalized = normalizeWiedzaPitchZone(zoneName);
  if (!normalized) return false;
  const zoneIndex = zoneNameToIndex(normalized);
  if (zoneIndex === null) return false;
  return zoneIndex % 12 <= 5;
}

export function isRegainOnOwnHalfForMap(action: Action): boolean {
  const zoneName = normalizeWiedzaPitchZone(regainAttackZoneRawForMap(action));
  if (!zoneName) return false;
  return isOwnHalfZoneForMap(zoneName);
}

/** Kolumny 1–6 siatki = własna połowa, 7–12 = połowa przeciwnika (jak Statystyki zespołu / heatmapy). */
export function isRegainOnOpponentHalfForMap(action: Action): boolean {
  const zoneName = normalizeWiedzaPitchZone(regainAttackZoneRawForMap(action));
  if (!zoneName) return false;
  const zoneIndex = zoneNameToIndex(zoneName);
  if (zoneIndex === null) return false;
  return zoneIndex % 12 > 5;
}

export function isLoseOnOwnHalfForMap(action: Action): boolean {
  const zoneName = normalizeWiedzaPitchZone(losesZoneRawForMap(action));
  if (!zoneName) return false;
  return isOwnHalfZoneForMap(zoneName);
}

export function isLoseOnOpponentHalfForMap(action: Action): boolean {
  const zoneName = normalizeWiedzaPitchZone(losesZoneRawForMap(action));
  if (!zoneName) return false;
  return !isOwnHalfZoneForMap(zoneName);
}
