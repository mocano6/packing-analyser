import type { StatsBombMatchRow } from "./statsbombCsvParser";
import {
  getStatsBombMatchOutcome,
  type StatsBombMatchOutcome,
} from "./statsBombMatchOutcome";
import {
  STATSBOMB_TEAM_MEDIAN_CATEGORY_LABELS,
  type StatsBombMedianDistributionReport,
  type StatsBombMetricDistributionRow,
  type StatsBombTeamMedianCategoryId,
} from "./statsBombMedianDistribution";
import { statsBombMatchRowId } from "./statsBombTeamMedianDistribution";

export type StatsBombOutcomeMedianGroupKey = "all" | StatsBombMatchOutcome;

export type StatsBombMatchDeviationEntry = {
  matchId: string;
  opponent: string;
  date: string;
  outcome: StatsBombMatchOutcome;
  value: number;
  deviation: number;
  deviationPct: number | null;
};

export type StatsBombOutcomeGroupMetricStats = {
  matchCount: number;
  avgValue: number | null;
  avgDeviation: number | null;
  avgAbsDeviation: number | null;
  aboveMedianCount: number;
  belowMedianCount: number;
  topPositive: StatsBombMatchDeviationEntry[];
  topNegative: StatsBombMatchDeviationEntry[];
};

export type StatsBombOutcomeMetricSummary = {
  id: string;
  label: string;
  description?: string;
  categoryId: StatsBombTeamMedianCategoryId;
  categoryLabel: string;
  phase: StatsBombMetricDistributionRow["phase"];
  seasonMedian: number;
  all: StatsBombOutcomeGroupMetricStats;
  win: StatsBombOutcomeGroupMetricStats;
  draw: StatsBombOutcomeGroupMetricStats;
  loss: StatsBombOutcomeGroupMetricStats;
};

export type StatsBombTeamOutcomeMedianReport = {
  summary: { winCount: number; drawCount: number; lossCount: number; totalCount: number };
  metrics: StatsBombOutcomeMetricSummary[];
  rankedByOutcome: Record<StatsBombOutcomeMedianGroupKey, StatsBombOutcomeMetricSummary[]>;
};

const OUTCOME_GROUPS: StatsBombOutcomeMedianGroupKey[] = ["all", "win", "draw", "loss"];
const TOP_DEVIATIONS = 3;

function deviationPct(value: number, median: number): number | null {
  if (!Number.isFinite(median) || Math.abs(median) < 1e-9) return null;
  return ((value - median) / Math.abs(median)) * 100;
}

function emptyGroupStats(): StatsBombOutcomeGroupMetricStats {
  return {
    matchCount: 0,
    avgValue: null,
    avgDeviation: null,
    avgAbsDeviation: null,
    aboveMedianCount: 0,
    belowMedianCount: 0,
    topPositive: [],
    topNegative: [],
  };
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function buildGroupStats(
  entries: StatsBombMatchDeviationEntry[],
  median: number,
): StatsBombOutcomeGroupMetricStats {
  if (entries.length === 0) return emptyGroupStats();

  const deviations = entries.map((e) => e.deviation);
  const values = entries.map((e) => e.value);
  let aboveMedianCount = 0;
  let belowMedianCount = 0;

  for (const entry of entries) {
    if (entry.value > median) aboveMedianCount += 1;
    else if (entry.value < median) belowMedianCount += 1;
  }

  const sortedPositive = [...entries].sort((a, b) => b.deviation - a.deviation);
  const sortedNegative = [...entries].sort((a, b) => a.deviation - b.deviation);

  return {
    matchCount: entries.length,
    avgValue: mean(values),
    avgDeviation: mean(deviations),
    avgAbsDeviation: mean(deviations.map((d) => Math.abs(d))),
    aboveMedianCount,
    belowMedianCount,
    topPositive: sortedPositive.slice(0, TOP_DEVIATIONS),
    topNegative: sortedNegative.slice(0, TOP_DEVIATIONS),
  };
}

function buildMetricSummary(
  metric: StatsBombMetricDistributionRow,
  outcomeByMatchId: Map<string, StatsBombMatchOutcome>,
): StatsBombOutcomeMetricSummary {
  const median = metric.stats.median;
  const allEntries: StatsBombMatchDeviationEntry[] = [];
  const winEntries: StatsBombMatchDeviationEntry[] = [];
  const drawEntries: StatsBombMatchDeviationEntry[] = [];
  const lossEntries: StatsBombMatchDeviationEntry[] = [];

  for (const obs of metric.observations) {
    const outcome = outcomeByMatchId.get(obs.id) ?? "loss";
    const entry: StatsBombMatchDeviationEntry = {
      matchId: obs.id,
      opponent: obs.label,
      date: obs.subLabel ?? "",
      outcome,
      value: obs.value,
      deviation: obs.value - median,
      deviationPct: deviationPct(obs.value, median),
    };
    allEntries.push(entry);
    if (outcome === "win") winEntries.push(entry);
    else if (outcome === "draw") drawEntries.push(entry);
    else lossEntries.push(entry);
  }

  const categoryLabel =
    STATSBOMB_TEAM_MEDIAN_CATEGORY_LABELS[metric.categoryId as StatsBombTeamMedianCategoryId] ??
    metric.categoryId;

  return {
    id: metric.id,
    label: metric.label,
    description: metric.description,
    categoryId: metric.categoryId as StatsBombTeamMedianCategoryId,
    categoryLabel,
    phase: metric.phase,
    seasonMedian: median,
    all: buildGroupStats(allEntries, median),
    win: buildGroupStats(winEntries, median),
    draw: buildGroupStats(drawEntries, median),
    loss: buildGroupStats(lossEntries, median),
  };
}

function rankMetricsByGroup(
  metrics: StatsBombOutcomeMetricSummary[],
  group: StatsBombOutcomeMedianGroupKey,
): StatsBombOutcomeMetricSummary[] {
  return [...metrics]
    .filter((metric) => metric[group].matchCount > 0 && metric[group].avgAbsDeviation !== null)
    .sort((a, b) => (b[group].avgAbsDeviation ?? 0) - (a[group].avgAbsDeviation ?? 0));
}

export function buildStatsBombTeamOutcomeMedianReport(
  rows: StatsBombMatchRow[],
  medianReport: StatsBombMedianDistributionReport,
): StatsBombTeamOutcomeMedianReport | null {
  if (rows.length === 0 || medianReport.allMetrics.length === 0) return null;

  const outcomeByMatchId = new Map<string, StatsBombMatchOutcome>();
  let winCount = 0;
  let drawCount = 0;
  let lossCount = 0;

  for (const row of rows) {
    const outcome = getStatsBombMatchOutcome(row);
    outcomeByMatchId.set(statsBombMatchRowId(row), outcome);
    if (outcome === "win") winCount += 1;
    else if (outcome === "draw") drawCount += 1;
    else lossCount += 1;
  }

  const metrics = medianReport.allMetrics.map((metric) =>
    buildMetricSummary(metric, outcomeByMatchId),
  );

  const rankedByOutcome = {} as Record<StatsBombOutcomeMedianGroupKey, StatsBombOutcomeMetricSummary[]>;
  for (const group of OUTCOME_GROUPS) {
    rankedByOutcome[group] = rankMetricsByGroup(metrics, group);
  }

  return {
    summary: {
      winCount,
      drawCount,
      lossCount,
      totalCount: rows.length,
    },
    metrics,
    rankedByOutcome,
  };
}

export function statsBombOutcomeMedianGroupLabel(group: StatsBombOutcomeMedianGroupKey): string {
  switch (group) {
    case "win":
      return "Wygrane";
    case "draw":
      return "Remisy";
    case "loss":
      return "Przegrane";
    default:
      return "Wszystkie mecze";
  }
}

export type StatsBombOutcomeSummarySortKey =
  | "label"
  | "categoryLabel"
  | "seasonMedian"
  | "avgValue"
  | "avgDeviation"
  | "avgAbsDeviation"
  | "aboveMedianCount"
  | "belowMedianCount"
  | "matchCount";

export type StatsBombOutcomeSummarySortDirection = "asc" | "desc";

export const STATSBOMB_OUTCOME_SUMMARY_DEFAULT_SORT: StatsBombOutcomeSummarySortKey = "avgAbsDeviation";
export const STATSBOMB_OUTCOME_SUMMARY_DEFAULT_DIRECTION: StatsBombOutcomeSummarySortDirection = "desc";

function compareSortValues(
  a: string | number | null,
  b: string | number | null,
  direction: StatsBombOutcomeSummarySortDirection,
): number {
  const factor = direction === "asc" ? 1 : -1;

  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;

  if (typeof a === "string" && typeof b === "string") {
    return factor * a.localeCompare(b, "pl", { sensitivity: "base" });
  }

  const na = typeof a === "number" ? a : Number(a);
  const nb = typeof b === "number" ? b : Number(b);
  if (!Number.isFinite(na) && !Number.isFinite(nb)) return 0;
  if (!Number.isFinite(na)) return 1;
  if (!Number.isFinite(nb)) return -1;
  return factor * (na - nb);
}

export function getOutcomeMetricSummarySortValue(
  metric: StatsBombOutcomeMetricSummary,
  group: StatsBombOutcomeMedianGroupKey,
  sortKey: StatsBombOutcomeSummarySortKey,
): string | number | null {
  const stats = metric[group];

  switch (sortKey) {
    case "label":
      return metric.label;
    case "categoryLabel":
      return metric.categoryLabel;
    case "seasonMedian":
      return metric.seasonMedian;
    case "avgValue":
      return stats.avgValue;
    case "avgDeviation":
      return stats.avgDeviation;
    case "avgAbsDeviation":
      return stats.avgAbsDeviation;
    case "aboveMedianCount":
      return stats.aboveMedianCount;
    case "belowMedianCount":
      return stats.belowMedianCount;
    case "matchCount":
      return stats.matchCount;
    default:
      return null;
  }
}

export function sortOutcomeMetricSummaries(
  metrics: StatsBombOutcomeMetricSummary[],
  group: StatsBombOutcomeMedianGroupKey,
  sortKey: StatsBombOutcomeSummarySortKey = STATSBOMB_OUTCOME_SUMMARY_DEFAULT_SORT,
  direction: StatsBombOutcomeSummarySortDirection = STATSBOMB_OUTCOME_SUMMARY_DEFAULT_DIRECTION,
): StatsBombOutcomeMetricSummary[] {
  return [...metrics].sort((a, b) => {
    const primary = compareSortValues(
      getOutcomeMetricSummarySortValue(a, group, sortKey),
      getOutcomeMetricSummarySortValue(b, group, sortKey),
      direction,
    );
    if (primary !== 0) return primary;
    return a.label.localeCompare(b.label, "pl", { sensitivity: "base" });
  });
}

export function toggleOutcomeSummarySort(
  currentKey: StatsBombOutcomeSummarySortKey,
  currentDirection: StatsBombOutcomeSummarySortDirection,
  nextKey: StatsBombOutcomeSummarySortKey,
): { sortKey: StatsBombOutcomeSummarySortKey; direction: StatsBombOutcomeSummarySortDirection } {
  if (currentKey === nextKey) {
    return {
      sortKey: nextKey,
      direction: currentDirection === "asc" ? "desc" : "asc",
    };
  }
  const numericKeys: StatsBombOutcomeSummarySortKey[] = [
    "seasonMedian",
    "avgValue",
    "avgDeviation",
    "avgAbsDeviation",
    "aboveMedianCount",
    "belowMedianCount",
    "matchCount",
  ];
  return {
    sortKey: nextKey,
    direction: numericKeys.includes(nextKey) ? "desc" : "asc",
  };
}
