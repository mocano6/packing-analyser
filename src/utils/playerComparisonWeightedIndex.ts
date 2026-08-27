import {
  roundPlayerComparisonMetricForDisplay,
  PLAYER_COMPARISON_METRICS,
  type PlayerComparisonMetricId,
  type PlayerComparisonMetricRole,
  type PlayerComparisonRow,
} from "./playerComparisonMetrics";
import {
  getWeightedIndexEventDisplayMode,
  resolvePlayerComparisonMetricEventStats,
  type WeightedIndexEventDisplayMode,
} from "./playerComparisonMetricEventStats";

export type WeightedIndexBetterWhen = "higher" | "lower";

export type PlayerComparisonWeightedMetricConfig = {
  metricId: PlayerComparisonMetricId;
  weight: number;
  enabled: boolean;
  /** Wyższa czy niższa wartość surowa daje lepszy wynik w indeksie. */
  betterWhen: WeightedIndexBetterWhen;
};

/** Wszystkie KPI dostępne w indeksie wagowym — z rozbiciem na podanie / przyjęcie / drybling tam, gdzie ma to sens. */
export const WEIGHTED_INDEX_SELECTABLE_METRIC_IDS: readonly PlayerComparisonMetricId[] = [
  "packingSender",
  "packingReceiver",
  "packingDribble",
  "pxtSender",
  "pxtReceiver",
  "pxtDribble",
  "xtSender",
  "xtReceiver",
  "xtDribble",
  "phaseP1Sender",
  "phaseP1Receiver",
  "phaseP1Dribble",
  "phaseP2Sender",
  "phaseP2Receiver",
  "phaseP2Dribble",
  "phaseP3Sender",
  "phaseP3Receiver",
  "phaseP3Dribble",
  "xg",
  "shots",
  "goals",
  "xgPerShot",
  "shotsPerGoal",
  "xgPerGoal",
  "pkEntriesSender",
  "pkEntriesReceiver",
  "pkEntriesDribble",
  "xgOnPitchAttack",
  "xgOnPitchDefense",
  "pkEntriesOnPitchAttack",
  "pkEntriesOnPitchDefense",
  "regains",
  "regainsOwnHalf",
  "regainsOpponentHalf",
  "regainsXt",
  "regainsXtAttack",
  "regainsXtDefense",
  "loses",
  "losesOwnHalf",
  "losesOpponentHalf",
  "losesXt",
  "losesXtAttack",
  "losesXtDefense",
  "defenseShotLine",
  "defenseShotBlockXg",
];

const WEIGHTED_INDEX_METRIC_ID_SET = new Set<string>(WEIGHTED_INDEX_SELECTABLE_METRIC_IDS);

export function isWeightedIndexSelectableMetricId(value: string): value is PlayerComparisonMetricId {
  return WEIGHTED_INDEX_METRIC_ID_SET.has(value);
}

export function getDefaultWeightedIndexBetterWhen(metricId: PlayerComparisonMetricId): WeightedIndexBetterWhen {
  const direction = PLAYER_COMPARISON_METRICS.find((metric) => metric.id === metricId)?.direction;
  return direction === "lower" ? "lower" : "higher";
}

export function getWeightedIndexBetterWhenLabel(betterWhen: WeightedIndexBetterWhen): string {
  return betterWhen === "lower" ? "↓ mniej" : "↑ więcej";
}

/**
 * Normalizacja 0–100 do indeksu wagowego — wyższy wynik zawsze = lepszy dla zawodnika.
 * Nie używa logiki radaru (tam strat „więcej = dalej” służy tylko wizualizacji).
 */
export function normalizeWeightedIndexMetricScore(
  rows: PlayerComparisonRow[],
  row: PlayerComparisonRow,
  metricId: PlayerComparisonMetricId,
  betterWhen: WeightedIndexBetterWhen,
): number {
  const values = rows
    .map((item) => roundPlayerComparisonMetricForDisplay(metricId, item.values[metricId]))
    .filter(Number.isFinite);
  if (values.length === 0) return 0;

  const max = Math.max(...values, 0);
  const value = roundPlayerComparisonMetricForDisplay(metricId, row.values[metricId]);
  if (!Number.isFinite(value)) return 0;

  if (max <= 0) return 100;

  const score =
    betterWhen === "higher" ? (value / max) * 100 : (1 - value / max) * 100;
  return Math.max(0, Math.min(100, score));
}

export function getWeightedIndexMetricLabel(metricId: PlayerComparisonMetricId): string {
  return PLAYER_COMPARISON_METRICS.find((metric) => metric.id === metricId)?.label ?? metricId;
}

export const WEIGHTED_INDEX_PERCENT_BUDGET = 100;

/** @deprecated Użyj WEIGHTED_INDEX_PERCENT_BUDGET. */
export const WEIGHTED_INDEX_POINT_BUDGET = WEIGHTED_INDEX_PERCENT_BUDGET;

export type PlayerComparisonWeightedMetricContribution = {
  metricId: PlayerComparisonMetricId;
  label: string;
  weight: number;
  normalizedScore: number;
  contribution: number;
  /** Wartość surowa w wybranym trybie (suma lub per 90) użyta do normalizacji. */
  rawValue: number;
  /** Liczba zdarzeń w zakresie (nie skaluje się per 90). */
  eventTotal: number | null;
  /** Zdarzenia uznane za skuteczne (definicja zależy od KPI). */
  eventSuccessful: number | null;
  /** ratio = etykieta skuteczne/wszystkie; countOnly = sama liczba zdarzeń. */
  eventDisplayMode: WeightedIndexEventDisplayMode;
};

export type PlayerComparisonWeightedIndexResult = {
  index: number;
  contributions: PlayerComparisonWeightedMetricContribution[];
  activeWeightSum: number;
};

const clampWeight = (value: number): number =>
  Math.max(0, Math.min(WEIGHTED_INDEX_PERCENT_BUDGET, Math.round(value)));

export function getActiveWeightedMetricConfigs(
  configs: PlayerComparisonWeightedMetricConfig[],
): PlayerComparisonWeightedMetricConfig[] {
  return configs.filter((c) => c.enabled && c.weight > 0);
}

export function getActiveWeightedMetricWeightSum(configs: PlayerComparisonWeightedMetricConfig[]): number {
  return getActiveWeightedMetricConfigs(configs).reduce((sum, config) => sum + config.weight, 0);
}

export function sanitizeWeightedIndexConfigs(
  configs: PlayerComparisonWeightedMetricConfig[],
): PlayerComparisonWeightedMetricConfig[] {
  return configs.map((config) => ({
    ...config,
    betterWhen:
      config.betterWhen === "lower" || config.betterWhen === "higher"
        ? config.betterWhen
        : getDefaultWeightedIndexBetterWhen(config.metricId),
    weight: config.enabled ? clampWeight(config.weight) : 0,
  }));
}

export function isWeightedIndexOverBudget(configs: PlayerComparisonWeightedMetricConfig[]): boolean {
  return getActiveWeightedMetricWeightSum(configs) > WEIGHTED_INDEX_PERCENT_BUDGET;
}

export function canComputeWeightedIndex(configs: PlayerComparisonWeightedMetricConfig[]): boolean {
  const active = getActiveWeightedMetricConfigs(configs);
  if (active.length === 0) return false;
  const sum = getActiveWeightedMetricWeightSum(configs);
  return sum > 0 && sum <= WEIGHTED_INDEX_PERCENT_BUDGET;
}

export function normalizeWeightedMetricConfigs(
  configs: PlayerComparisonWeightedMetricConfig[],
): PlayerComparisonWeightedMetricConfig[] {
  const active = getActiveWeightedMetricConfigs(configs);
  if (active.length === 0) return configs;
  const sum = active.reduce((acc, c) => acc + c.weight, 0);
  if (sum <= 0) return configs;
  return configs.map((c) => {
    if (!c.enabled || c.weight <= 0) return { ...c, weight: 0 };
    return { ...c, weight: clampWeight((c.weight / sum) * WEIGHTED_INDEX_PERCENT_BUDGET) };
  });
}

export function toggleWeightedIndexMetric(
  configs: PlayerComparisonWeightedMetricConfig[],
  metricId: PlayerComparisonMetricId,
  enabled: boolean,
): PlayerComparisonWeightedMetricConfig[] {
  return configs.map((config) => {
    if (config.metricId !== metricId) return config;
    if (!enabled) return { ...config, enabled: false, weight: 0 };
    return { ...config, enabled: true };
  });
}

export function setWeightedIndexMetricWeight(
  configs: PlayerComparisonWeightedMetricConfig[],
  metricId: PlayerComparisonMetricId,
  requestedWeight: number,
): PlayerComparisonWeightedMetricConfig[] {
  const target = configs.find((config) => config.metricId === metricId);
  if (!target?.enabled) return configs;

  const othersSum = configs
    .filter((config) => config.enabled && config.metricId !== metricId)
    .reduce((sum, config) => sum + config.weight, 0);
  const maxForMetric = Math.max(0, WEIGHTED_INDEX_PERCENT_BUDGET - othersSum);
  const nextWeight = clampWeight(Math.min(requestedWeight, maxForMetric));

  return configs.map((config) =>
    config.metricId === metricId ? { ...config, weight: nextWeight } : config,
  );
}

export function setWeightedIndexMetricBetterWhen(
  configs: PlayerComparisonWeightedMetricConfig[],
  metricId: PlayerComparisonMetricId,
  betterWhen: WeightedIndexBetterWhen,
): PlayerComparisonWeightedMetricConfig[] {
  return configs.map((config) =>
    config.metricId === metricId ? { ...config, betterWhen } : config,
  );
}

export function computePlayerWeightedIndex(
  rows: PlayerComparisonRow[],
  row: PlayerComparisonRow,
  configs: PlayerComparisonWeightedMetricConfig[],
): PlayerComparisonWeightedIndexResult {
  const active = getActiveWeightedMetricConfigs(configs);
  const weightSum = active.reduce((acc, c) => acc + c.weight, 0);

  if (active.length === 0 || weightSum <= 0) {
    return { index: 0, contributions: [], activeWeightSum: 0 };
  }

  const contributions: PlayerComparisonWeightedMetricContribution[] = active.map((config) => {
    const normalizedScore = normalizeWeightedIndexMetricScore(
      rows,
      row,
      config.metricId,
      config.betterWhen,
    );
    const weightFraction = config.weight / weightSum;
    const eventStats = resolvePlayerComparisonMetricEventStats(row, config.metricId);
    return {
      metricId: config.metricId,
      label: getWeightedIndexMetricLabel(config.metricId),
      weight: config.weight,
      normalizedScore,
      contribution: normalizedScore * weightFraction,
      rawValue: row.values[config.metricId],
      eventTotal: eventStats?.total ?? null,
      eventSuccessful: eventStats?.successful ?? null,
      eventDisplayMode: getWeightedIndexEventDisplayMode(config.metricId),
    };
  });

  const index = contributions.reduce((sum, item) => sum + item.contribution, 0);

  return {
    index: Math.max(0, Math.min(100, index)),
    contributions,
    activeWeightSum: weightSum,
  };
}

export type PlayerComparisonWeightedIndexRankingRow = {
  row: PlayerComparisonRow;
  index: number;
  contributions: PlayerComparisonWeightedMetricContribution[];
};

export function buildPlayerWeightedIndexRanking(
  rows: PlayerComparisonRow[],
  configs: PlayerComparisonWeightedMetricConfig[],
): PlayerComparisonWeightedIndexRankingRow[] {
  return rows
    .map((row) => {
      const result = computePlayerWeightedIndex(rows, row, configs);
      return { row, index: result.index, contributions: result.contributions };
    })
    .sort((a, b) => b.index - a.index);
}

export function formatWeightedIndexValue(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function formatWeightedMetricPercent(weight: number): string {
  if (!Number.isFinite(weight)) return "—";
  const formatted = weight.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  return `${formatted} %`;
}

/** @deprecated Użyj formatWeightedMetricPercent. */
export function formatWeightedMetricWeight(weight: number): string {
  if (!Number.isFinite(weight)) return "—";
  return weight.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

export function getRemainingWeightedIndexPercent(configs: PlayerComparisonWeightedMetricConfig[]): number {
  return Math.max(0, WEIGHTED_INDEX_PERCENT_BUDGET - getActiveWeightedMetricWeightSum(configs));
}

/** @deprecated Użyj getRemainingWeightedIndexPercent. */
export function getRemainingWeightedIndexPoints(configs: PlayerComparisonWeightedMetricConfig[]): number {
  return getRemainingWeightedIndexPercent(configs);
}

/** @deprecated Indeks wagowy nie używa globalnej roli — zachowane dla kompatybilności sygnatur. */
export type PlayerComparisonWeightedIndexLegacyRole = PlayerComparisonMetricRole;
