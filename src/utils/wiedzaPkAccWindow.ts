import { Acc8sEntry, PKEntry, TeamInfo } from "@/types";
import { TrendyMapSide } from "@/utils/trendyMapFilters";

/** Okno od tagu przekroczenia połowy (start 8s ACC) do wejścia w pole karne. */
export const PK_ACC_WINDOW_8_SECONDS = 8;
export const PK_ACC_WINDOW_15_SECONDS = 15;

export type PkAccWindowSummary = {
  /** Wejścia PK w próbie (mianownik procentów). */
  totalEntries: number;
  within8s: number;
  within15s: number;
  within8sPct: number;
  within15sPct: number;
  idsWithin8s: Set<string>;
  idsWithin15s: Set<string>;
};

/**
 * Surowy czas nagrania — jak weryfikacja flag w Acc8sTable.
 * `videoTimestamp` ma odjęte 10 s, więc przy braku raw dodajemy je z powrotem.
 */
export function accEventVideoRawSeconds(event: {
  videoTimestampRaw?: number | null;
  videoTimestamp?: number | null;
}): number | null {
  const raw = event.videoTimestampRaw;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const adjusted = event.videoTimestamp;
  if (typeof adjusted === "number" && Number.isFinite(adjusted)) return adjusted + 10;
  return null;
}

function sideKey(matchId: string, teamContext: string | undefined): string {
  const side = teamContext === "defense" ? "defense" : "attack";
  return `${matchId}|${side}`;
}

/** Najbliższy wcześniejszy start 8s ACC (ten sam mecz i ta sama strona POV). */
export function closestAccDeltaSeconds(
  pk: PKEntry,
  accStartsByKey: Map<string, number[]>,
): number | null {
  const pkTime = accEventVideoRawSeconds(pk);
  if (pkTime === null) return null;
  const starts = accStartsByKey.get(sideKey(pk.matchId, pk.teamContext));
  if (!starts || starts.length === 0) return null;

  let lo = 0;
  let hi = starts.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= pkTime) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (best < 0) return null;
  return pkTime - starts[best];
}

export function indexAccStarts(accEntries: Acc8sEntry[]): Map<string, number[]> {
  const grouped = new Map<string, number[]>();
  for (const entry of accEntries) {
    const time = accEventVideoRawSeconds(entry);
    if (time === null) continue;
    const key = sideKey(entry.matchId, entry.teamContext);
    const list = grouped.get(key);
    if (list) list.push(time);
    else grouped.set(key, [time]);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => a - b);
  }
  return grouped;
}

export function summarizePkEntriesAgainstAcc(
  pkEntries: PKEntry[],
  accEntries: Acc8sEntry[],
): PkAccWindowSummary {
  const starts = indexAccStarts(accEntries);
  const idsWithin8s = new Set<string>();
  const idsWithin15s = new Set<string>();

  for (const entry of pkEntries) {
    const delta = closestAccDeltaSeconds(entry, starts);
    if (delta === null || delta < 0) continue;
    if (delta <= PK_ACC_WINDOW_15_SECONDS) idsWithin15s.add(entry.id);
    if (delta <= PK_ACC_WINDOW_8_SECONDS) idsWithin8s.add(entry.id);
  }

  const totalEntries = pkEntries.length;
  return {
    totalEntries,
    within8s: idsWithin8s.size,
    within15s: idsWithin15s.size,
    within8sPct: totalEntries > 0 ? (idsWithin8s.size / totalEntries) * 100 : 0,
    within15sPct: totalEntries > 0 ? (idsWithin15s.size / totalEntries) * 100 : 0,
    idsWithin8s,
    idsWithin15s,
  };
}

export function collectAcc8sEntriesForSide(matches: TeamInfo[], side: TrendyMapSide): Acc8sEntry[] {
  const out: Acc8sEntry[] = [];
  for (const match of matches) {
    const matchId = match.matchId ?? "";
    for (const entry of match.acc8sEntries ?? []) {
      if (!entry) continue;
      const entrySide: TrendyMapSide = entry.teamContext === "defense" ? "defense" : "attack";
      if (entrySide !== side) continue;
      out.push({
        ...entry,
        teamContext: entrySide,
        matchId: entry.matchId || matchId,
      });
    }
  }
  return out;
}
