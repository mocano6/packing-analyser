import type { Action } from "@/types";
import { zoneNameToIndex } from "@/constants/xtValues";

/** Format migracji: litera = kolumna, liczba = wiersz. */
function zoneFromMigrateFormat(str: string): number | null {
  if (!str || str.length < 2) return null;
  const letter = str[0].toLowerCase();
  const num = parseInt(str.slice(1), 10);
  if (Number.isNaN(num) || num < 1 || num > 8) return null;
  const colLetters = "abcdefghijkl".split("");
  const colIdx = colLetters.indexOf(letter);
  if (colIdx === -1) return null;
  return (num - 1) * 12 + colIdx;
}

export function resolveZoneIndex(zone: string | number | null | undefined): number | null {
  if (zone == null) return null;
  if (typeof zone === "number" && zone >= 0 && zone < 96) return zone;
  const str = String(zone).trim().replace(/\s+/g, "");
  if (!str) return null;
  const asNum = parseInt(str, 10);
  if (!Number.isNaN(asNum) && asNum >= 0 && asNum < 96) return asNum;
  let idx = zoneNameToIndex(str.toUpperCase());
  if (idx !== null) return idx;
  return zoneFromMigrateFormat(str);
}

export function zoneIndexToPitchPercent(index: number): { x: number; y: number } {
  const row = Math.floor(index / 12);
  const col = index % 12;
  return {
    x: ((col + 0.5) / 12) * 100,
    y: ((row + 0.5) / 8) * 100,
  };
}

export function resolvePackingActionStartZone(action: Action): string | number | null | undefined {
  return action.fromZone ?? action.startZone;
}

export function resolvePackingActionEndZone(action: Action): string | number | null | undefined {
  return action.toZone ?? action.endZone ?? resolvePackingActionStartZone(action);
}

export type PackingActionPitchCoords = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

/** Współrzędne % boiska (0–100) dla strzałki packing; null gdy brak stref. */
export function actionToPitchCoordinates(action: Action): PackingActionPitchCoords | null {
  const startIdx = resolveZoneIndex(resolvePackingActionStartZone(action));
  const endIdx = resolveZoneIndex(resolvePackingActionEndZone(action));
  if (startIdx === null || endIdx === null) return null;
  const start = zoneIndexToPitchPercent(startIdx);
  const end = zoneIndexToPitchPercent(endIdx);
  return {
    startX: start.x,
    startY: start.y,
    endX: end.x,
    endY: end.y,
  };
}
