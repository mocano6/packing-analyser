import type { Action, TeamInfo } from "../types";
import { normalizeWiedzaPitchZone } from "./wiedzaZoneHeatmaps";

/** Metryka agregacji na krawędzi stref i w grupach kontaktów. */
export type PackingFlowMetric = "pxt" | "xtDelta" | "packPts";

export type PackingContactKind = "c1" | "c2" | "c3" | "unknown";

export type PackingEdgeAgg = {
  n: number;
  sumPxt: number;
  sumXtDelta: number;
  sumPackPts: number;
};

export type PackingContactBucket = {
  n: number;
  sumPxt: number;
  sumXtDelta: number;
  sumPackPts: number;
};

export type WiedzaPackingFlowResult = {
  /** Akcje ataku włączone do statystyk kontaktów i (gdy da się) do macierzy. */
  totalActions: number;
  /** Akcje z parą stref start→koniec (wejście do macierzy). */
  actionsWithZonePair: number;
  /** Unikalne strefy (wiersze/kolumny macierzy), posortowane. */
  zoneKeys: string[];
  /** Klucz: `${start}\\t${end}` (znormalizowane strefy). */
  edgeByKey: Map<string, PackingEdgeAgg>;
  contactBuckets: Record<PackingContactKind, PackingContactBucket>;
  /**
   * Rozkład kontaktów po strefie startu: dla każdej strefy liczba akcji wg typu kontaktu.
   * Klucz strefy: znormalizowany kod lub "(brak strefy)".
   */
  zoneContactCounts: Map<string, Map<PackingContactKind, number>>;
};

const EMPTY_BUCKET = (): PackingContactBucket => ({
  n: 0,
  sumPxt: 0,
  sumXtDelta: 0,
  sumPackPts: 0,
});

const ZONE_MISSING = "(brak strefy)";

/**
 * Wybiera pierwsze sensowne pole strefy. `??` nie obsługuje pustego stringa — w danych często jest
 * startZone/endZone puste, a fromZone/toZone wypełnione (lub odwrotnie).
 */
function zoneField(
  primary: string | number | null | undefined,
  fallback: string | number | null | undefined,
): string | number | null | undefined {
  const has = (v: unknown): v is string | number =>
    v !== null && v !== undefined && !(typeof v === "string" && v.trim() === "");
  if (has(primary)) return primary;
  if (has(fallback)) return fallback;
  return undefined;
}

/** PxT = Σ(ΔxT × pkt) na akcji — jak w reszcie Wiedzy. */
export function packingActionMetrics(a: Action): { pxt: number; xtDelta: number; packPts: number } {
  const xtDelta = (a.xTValueEnd ?? 0) - (a.xTValueStart ?? 0);
  const packPts = a.packingPoints ?? 0;
  return { pxt: xtDelta * packPts, xtDelta, packPts };
}

/** Tylko akcje z tablicy ataku (nie obrona / unpacking). */
export function isAttackPackingForMatchTeam(a: Action, matchTeam: string): boolean {
  if (a.mode === "defense") return false;
  if (a.teamId && a.teamId !== matchTeam) return false;
  return true;
}

/**
 * Priorytet: 3+ > 2 > 1 — gdy wiele flag (błąd danych), bierzemy „wyższą” grupę.
 */
export function packingContactKind(a: Action): PackingContactKind {
  if (a.isContact3Plus) return "c3";
  if (a.isContact2) return "c2";
  if (a.isContact1) return "c1";
  return "unknown";
}

export function packingStartEndZones(a: Action): { start: string; end: string } | null {
  const start = normalizeWiedzaPitchZone(zoneField(a.startZone, a.fromZone));
  const end = normalizeWiedzaPitchZone(zoneField(a.endZone, a.toZone));
  if (!start || !end) return null;
  return { start, end };
}

export function packingStartZoneOnly(a: Action): string {
  const z = normalizeWiedzaPitchZone(zoneField(a.startZone, a.fromZone));
  return z ?? ZONE_MISSING;
}

export function edgeKey(start: string, end: string): string {
  return `${start}\t${end}`;
}

export function metricFromBucket(b: PackingContactBucket, m: PackingFlowMetric): number {
  switch (m) {
    case "pxt":
      return b.sumPxt;
    case "xtDelta":
      return b.sumXtDelta;
    case "packPts":
      return b.sumPackPts;
    default:
      return 0;
  }
}

export function metricFromEdge(e: PackingEdgeAgg, m: PackingFlowMetric): number {
  switch (m) {
    case "pxt":
      return e.sumPxt;
    case "xtDelta":
      return e.sumXtDelta;
    case "packPts":
      return e.sumPackPts;
    default:
      return 0;
  }
}

function bumpEdge(map: Map<string, PackingEdgeAgg>, start: string, end: string, m: ReturnType<typeof packingActionMetrics>): void {
  const k = edgeKey(start, end);
  let row = map.get(k);
  if (!row) {
    row = { n: 0, sumPxt: 0, sumXtDelta: 0, sumPackPts: 0 };
    map.set(k, row);
  }
  row.n += 1;
  row.sumPxt += m.pxt;
  row.sumXtDelta += m.xtDelta;
  row.sumPackPts += m.packPts;
}

function bumpContact(
  buckets: Record<PackingContactKind, PackingContactBucket>,
  kind: PackingContactKind,
  m: ReturnType<typeof packingActionMetrics>,
): void {
  const b = buckets[kind];
  b.n += 1;
  b.sumPxt += m.pxt;
  b.sumXtDelta += m.xtDelta;
  b.sumPackPts += m.packPts;
}

/**
 * Agregacja akcji packing (atak) z próby meczów: macierz stref, kubełki kontaktów, rozkład po strefie startu.
 */
export function buildWiedzaPackingFlowFromMatches(matches: TeamInfo[]): WiedzaPackingFlowResult {
  const edgeByKey = new Map<string, PackingEdgeAgg>();
  const contactBuckets: Record<PackingContactKind, PackingContactBucket> = {
    c1: EMPTY_BUCKET(),
    c2: EMPTY_BUCKET(),
    c3: EMPTY_BUCKET(),
    unknown: EMPTY_BUCKET(),
  };
  const zoneContactCounts = new Map<string, Map<PackingContactKind, number>>();
  const zoneSet = new Set<string>();

  let totalActions = 0;
  let actionsWithZonePair = 0;

  for (const match of matches) {
    const team = match.team;
    const list = match.actions_packing ?? [];
    for (const a of list) {
      if (!isAttackPackingForMatchTeam(a, team)) continue;
      totalActions += 1;
      const met = packingActionMetrics(a);
      const kind = packingContactKind(a);
      bumpContact(contactBuckets, kind, met);

      const startOnly = packingStartZoneOnly(a);
      let zc = zoneContactCounts.get(startOnly);
      if (!zc) {
        zc = new Map<PackingContactKind, number>([
          ["c1", 0],
          ["c2", 0],
          ["c3", 0],
          ["unknown", 0],
        ]);
        zoneContactCounts.set(startOnly, zc);
      }
      zc.set(kind, (zc.get(kind) ?? 0) + 1);

      const pair = packingStartEndZones(a);
      if (!pair) continue;
      actionsWithZonePair += 1;
      zoneSet.add(pair.start);
      zoneSet.add(pair.end);
      bumpEdge(edgeByKey, pair.start, pair.end, met);
    }
  }

  const zoneKeys = [...zoneSet].sort((a, b) => a.localeCompare(b, "pl"));

  return {
    totalActions,
    actionsWithZonePair,
    zoneKeys,
    edgeByKey,
    contactBuckets,
    zoneContactCounts,
  };
}
