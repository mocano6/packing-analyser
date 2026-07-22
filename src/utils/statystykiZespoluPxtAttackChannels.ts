import type { Action } from "@/types";
import { getPackingMetrics, normalizePxtZoneKey } from "@/utils/statystykiZespoluPxtStats";

/** Pasy szerokości boiska (wzdłuż długości): skrzydła A–B / G–H, środek C–F. */
export type PxtAttackChannelId = "AB" | "C" | "D" | "E" | "F" | "GH";

export type PxtAttackChannelStats = {
  id: PxtAttackChannelId;
  /** Litera/litery stref (A–B, C, …). */
  letters: string;
  label: string;
  /** Skrzydło vs środek. */
  kind: "wing" | "center";
  /** Udział wysokości boiska (wiersze A–H = 8). */
  rowStart: number;
  rowSpan: number;
  count: number;
  pxt: number;
  xt: number;
  countSharePct: number;
  pxtSharePct: number;
};

const CHANNEL_DEFS: Array<{
  id: PxtAttackChannelId;
  letters: string;
  label: string;
  kind: "wing" | "center";
  rowStart: number;
  rowSpan: number;
  match: (letter: string) => boolean;
}> = [
  { id: "AB", letters: "A–B", label: "Lewa", kind: "wing", rowStart: 0, rowSpan: 2, match: (l) => l === "A" || l === "B" },
  { id: "C", letters: "C", label: "Środek C", kind: "center", rowStart: 2, rowSpan: 1, match: (l) => l === "C" },
  { id: "D", letters: "D", label: "Środek D", kind: "center", rowStart: 3, rowSpan: 1, match: (l) => l === "D" },
  { id: "E", letters: "E", label: "Środek E", kind: "center", rowStart: 4, rowSpan: 1, match: (l) => l === "E" },
  { id: "F", letters: "F", label: "Środek F", kind: "center", rowStart: 5, rowSpan: 1, match: (l) => l === "F" },
  { id: "GH", letters: "G–H", label: "Prawa", kind: "wing", rowStart: 6, rowSpan: 2, match: (l) => l === "G" || l === "H" },
];

function zoneLetter(zone: string | number | null | undefined): string | null {
  const normalized = normalizePxtZoneKey(zone);
  if (!normalized) return null;
  const letter = normalized.charAt(0).toUpperCase();
  return /[A-H]/.test(letter) ? letter : null;
}

/** Koniec akcji packing (podanie / drybling) — kierunek ataku. */
export function getPackingEndZone(action: Action): string | number | null | undefined {
  return action.toZone ?? action.endZone ?? action.startZone ?? action.fromZone ?? null;
}

function channelIdForLetter(letter: string): PxtAttackChannelId | null {
  const def = CHANNEL_DEFS.find((c) => c.match(letter));
  return def?.id ?? null;
}

/**
 * Agreguje packing (podania + dryblingi) wg pasa końca akcji.
 * Procenty: udział liczby akcji oraz udział sumy PxT w całym zbiorze.
 */
export function buildPxtAttackChannelStats(actions: Action[]): PxtAttackChannelStats[] {
  const buckets = new Map<PxtAttackChannelId, { count: number; pxt: number; xt: number }>();
  for (const def of CHANNEL_DEFS) {
    buckets.set(def.id, { count: 0, pxt: 0, xt: 0 });
  }

  let totalCount = 0;
  let totalPxt = 0;

  for (const action of actions) {
    const letter = zoneLetter(getPackingEndZone(action));
    if (!letter) continue;
    const channelId = channelIdForLetter(letter);
    if (!channelId) continue;

    const metrics = getPackingMetrics(action);
    const bucket = buckets.get(channelId)!;
    bucket.count += 1;
    bucket.pxt += metrics.pxt;
    bucket.xt += metrics.xtDelta;
    totalCount += 1;
    totalPxt += metrics.pxt;
  }

  return CHANNEL_DEFS.map((def) => {
    const bucket = buckets.get(def.id)!;
    return {
      id: def.id,
      letters: def.letters,
      label: def.label,
      kind: def.kind,
      rowStart: def.rowStart,
      rowSpan: def.rowSpan,
      count: bucket.count,
      pxt: bucket.pxt,
      xt: bucket.xt,
      countSharePct: totalCount > 0 ? (bucket.count / totalCount) * 100 : 0,
      pxtSharePct: totalPxt > 0 ? (bucket.pxt / totalPxt) * 100 : 0,
    };
  });
}
