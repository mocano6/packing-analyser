import {
  PLAYER_COMPARISON_METRICS,
  roundPlayerComparisonMetricForDisplay,
  type PlayerComparisonMetricId,
  type PlayerComparisonRow,
} from "./playerComparisonMetrics";

export type PlayerComparisonMetricEventStats = {
  total: number;
  successful: number;
};

export type PlayerComparisonEventStatsMap = Partial<
  Record<PlayerComparisonMetricId, PlayerComparisonMetricEventStats>
>;

/** ratio = etykieta „skuteczne/wszystkie”; countOnly = tylko liczba zdarzeń (bez podziału). */
export type WeightedIndexEventDisplayMode = "ratio" | "countOnly";

const RATIO_EVENT_METRICS = new Set<PlayerComparisonMetricId>([
  "regains",
  "regainsOwnHalf",
  "regainsOpponentHalf",
  "shots",
  "xg",
  "goals",
  "defenseShotLine",
]);

/** Metryki pochodne — pokaż zdarzenia ze źródłowego licznika. */
const EVENT_STATS_SOURCE_METRIC: Partial<Record<PlayerComparisonMetricId, PlayerComparisonMetricId>> = {
  xgPerShot: "shots",
  shotsPerGoal: "shots",
  xgPerGoal: "goals",
};

export function getWeightedIndexEventDisplayMode(
  metricId: PlayerComparisonMetricId,
): WeightedIndexEventDisplayMode {
  return RATIO_EVENT_METRICS.has(metricId) ? "ratio" : "countOnly";
}

export function createEmptyPlayerComparisonEventStats(): PlayerComparisonEventStatsMap {
  return {};
}

export function bumpPlayerComparisonEventStat(
  stats: PlayerComparisonEventStatsMap,
  metricId: PlayerComparisonMetricId,
  isSuccessful: boolean,
  count = 1,
): void {
  if (count <= 0) return;
  const bucket = stats[metricId] ?? { total: 0, successful: 0 };
  bucket.total += count;
  if (isSuccessful) bucket.successful += count;
  stats[metricId] = bucket;
}

/** Tylko licznik zdarzeń (bez podziału skuteczny/nieskuteczny w UI). */
export function bumpPlayerComparisonEventCountOnly(
  stats: PlayerComparisonEventStatsMap,
  metricId: PlayerComparisonMetricId,
  count = 1,
): void {
  if (count <= 0) return;
  const bucket = stats[metricId] ?? { total: 0, successful: 0 };
  bucket.total += count;
  stats[metricId] = bucket;
}

function inferEventStatsFromRawCount(
  row: PlayerComparisonRow,
  metricId: PlayerComparisonMetricId,
): PlayerComparisonMetricEventStats | null {
  const raw = row.raw[metricId];
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const definition = PLAYER_COMPARISON_METRICS.find((metric) => metric.id === metricId);
  if (!definition || definition.fractionDigits !== 0) return null;
  const total = Math.round(raw);
  if (total <= 0) return null;
  return { total, successful: 0 };
}

export function resolvePlayerComparisonMetricEventStats(
  row: PlayerComparisonRow,
  metricId: PlayerComparisonMetricId,
): PlayerComparisonMetricEventStats | null {
  const sourceMetricId = EVENT_STATS_SOURCE_METRIC[metricId] ?? metricId;
  const tracked = row.eventStats?.[sourceMetricId];
  if (tracked && tracked.total > 0) return tracked;
  return inferEventStatsFromRawCount(row, sourceMetricId);
}

export function getPlayerComparisonMetricEventStats(
  row: PlayerComparisonRow,
  metricId: PlayerComparisonMetricId,
): PlayerComparisonMetricEventStats | null {
  return resolvePlayerComparisonMetricEventStats(row, metricId);
}

/** Krótka etykieta na segment wykresu: „2/5” lub „80”. */
export function formatWeightedIndexChartEventLabel(
  metricId: PlayerComparisonMetricId,
  stats: PlayerComparisonMetricEventStats | null | undefined,
): string | null {
  if (!stats || stats.total <= 0) return null;
  if (getWeightedIndexEventDisplayMode(metricId) === "countOnly") {
    return String(stats.total);
  }
  return `${stats.successful}/${stats.total}`;
}

/** Opis pod tabelą / w tooltipie. */
export function formatWeightedIndexEventBreakdown(
  metricId: PlayerComparisonMetricId,
  stats: PlayerComparisonMetricEventStats | null | undefined,
): string | null {
  if (!stats || stats.total <= 0) return null;
  if (getWeightedIndexEventDisplayMode(metricId) === "countOnly") {
    const label = stats.total === 1 ? "zdarzenie" : "zdarzeń";
    return `${stats.total} ${label}`;
  }
  return `${stats.successful}/${stats.total} zdarz.`;
}

export function formatWeightedIndexContributionRawValue(
  metricId: PlayerComparisonMetricId,
  rawValue: number,
  locale = "pl-PL",
): string | null {
  if (!Number.isFinite(rawValue)) return null;
  const rounded = roundPlayerComparisonMetricForDisplay(metricId, rawValue);
  if (!Number.isFinite(rounded)) return null;
  const digits =
    metricId === "shotsPerGoal" || metricId === "xgPerGoal"
      ? 2
      : undefined;
  const formatted = rounded.toLocaleString(locale, {
    minimumFractionDigits: digits ?? 0,
    maximumFractionDigits: digits ?? 3,
  });
  return `wart. ${formatted}`;
}
