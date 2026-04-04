/**
 * Oblicza różnicę xT (xTValueEnd - xTValueStart) dla akcji packing.
 * Gdy xTValueStart/xTValueEnd są puste lub zerowe, oblicza wartości ze stref (fromZone, toZone, startZone, endZone).
 */
import type { Action } from "@/types";
import { getXTValueForZone, zoneNameToIndex } from "@/constants/xtValues";

/** Migracja używa formatu: litera=kolumna (0-11), liczba=wiersz (1-8). Standard: litera=wiersz, liczba=kolumna. */
function zoneFromMigrateFormat(str: string): number | null {
  if (!str || str.length < 2) return null;
  const letter = str[0].toLowerCase();
  const num = parseInt(str.slice(1), 10);
  if (Number.isNaN(num) || num < 1 || num > 8) return null;
  const colLetters = "abcdefghijkl".split("");
  const colIdx = colLetters.indexOf(letter);
  if (colIdx === -1) return null;
  const rowIdx = num - 1;
  return rowIdx * 12 + colIdx;
}

function zoneToXT(zone: string | number | null | undefined): number {
  if (zone == null) return 0;
  if (typeof zone === "number" && zone >= 0 && zone < 96) {
    return getXTValueForZone(zone);
  }
  const str = String(zone).trim().replace(/\s+/g, "");
  if (!str) return 0;
  // Liczba jako string (indeks strefy 0-95)
  const asNum = parseInt(str, 10);
  if (!Number.isNaN(asNum) && asNum >= 0 && asNum < 96) {
    return getXTValueForZone(asNum);
  }
  // Nazwa strefy np. "C5", "A1" (standard: litera=wiersz, liczba=kolumna)
  let idx = zoneNameToIndex(str.toUpperCase());
  if (idx !== null) return getXTValueForZone(idx);
  // Fallback: format migracji (litera=kolumna, liczba=wiersz)
  idx = zoneFromMigrateFormat(str);
  return idx !== null ? getXTValueForZone(idx) : 0;
}

export function getXTDifferenceForAction(action: Action): number {
  const startVal = action.xTValueStart;
  const endVal = action.xTValueEnd;

  const hasExplicitXT =
    (typeof startVal === "number" && Number.isFinite(startVal)) ||
    (typeof endVal === "number" && Number.isFinite(endVal));

  if (hasExplicitXT) {
    return (endVal ?? 0) - (startVal ?? 0);
  }

  const startZone = action.fromZone ?? (action as any).startZone;
  const endZone = action.toZone ?? (action as any).endZone ?? startZone;

  const xTStart = zoneToXT(startZone);
  const xTEnd = zoneToXT(endZone);

  return xTEnd - xTStart;
}
