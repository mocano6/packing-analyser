import type { StatsBombMatchRow } from "./statsbombCsvParser";
import {
  computeStatsBombDeviationPct,
  isStatsBombDeviationPctReliable,
} from "./statsBombMedianDeviation";
import {
  STATSBOMB_TEAM_MEDIAN_CATEGORY_LABELS,
  type StatsBombMedianDistributionReport,
  type StatsBombMetricDistributionRow,
  type StatsBombTeamMedianCategoryId,
} from "./statsBombMedianDistribution";
import type { StatsBombReportPhase } from "./statsBombTeamReport";
import { statsBombMatchRowId } from "./statsBombTeamMedianDistribution";

export type StatsBombMatchMedianDeviationRow = {
  metricId: string;
  label: string;
  description?: string;
  categoryId: StatsBombTeamMedianCategoryId;
  categoryLabel: string;
  phase: StatsBombReportPhase;
  median: number;
  matchValue: number;
  deviation: number;
  absDeviation: number;
  deviationPct: number | null;
  absDeviationPct: number | null;
  pctReliable: boolean;
};

export type StatsBombMatchMedianDeviationSortKey =
  | "label"
  | "categoryLabel"
  | "median"
  | "matchValue"
  | "deviation"
  | "deviationPct"
  | "absDeviation"
  | "absDeviationPct";

export type StatsBombMatchMedianDeviationSortDirection = "asc" | "desc";

export const STATSBOMB_MATCH_MEDIAN_DEVIATION_DEFAULT_SORT: StatsBombMatchMedianDeviationSortKey =
  "absDeviationPct";
export const STATSBOMB_MATCH_MEDIAN_DEVIATION_DEFAULT_DIRECTION: StatsBombMatchMedianDeviationSortDirection =
  "desc";

function resolveMatchMetricValue(
  metric: StatsBombMetricDistributionRow,
  highlightId: string,
  highlightMatchRow?: StatsBombMatchRow | null,
): number | null {
  const observation = metric.observations.find((obs) => obs.id === highlightId);
  if (observation) return observation.value;

  if (highlightMatchRow && statsBombMatchRowId(highlightMatchRow) === highlightId) {
    const value = highlightMatchRow.numeric[metric.label];
    return Number.isFinite(value) ? value : null;
  }

  return null;
}

export function buildStatsBombMatchMedianDeviations(
  report: StatsBombMedianDistributionReport,
  highlightId: string,
  highlightMatchRow?: StatsBombMatchRow | null,
): StatsBombMatchMedianDeviationRow[] {
  const rows: StatsBombMatchMedianDeviationRow[] = [];

  for (const metric of report.allMetrics) {
    const matchValue = resolveMatchMetricValue(metric, highlightId, highlightMatchRow);
    if (matchValue === null) continue;

    const { stats } = metric;
    const median = stats.median;
    const deviation = matchValue - median;
    const absDeviation = Math.abs(deviation);
    const sampleValues = metric.observations.map((obs) => obs.value);
    const pctReliable = isStatsBombDeviationPctReliable(stats, sampleValues);
    const deviationPct = pctReliable
      ? computeStatsBombDeviationPct(matchValue, median, stats)
      : null;
    const absDeviationPct =
      deviationPct === null ? null : Math.abs(deviationPct);

    const categoryId = metric.categoryId as StatsBombTeamMedianCategoryId;
    const categoryLabel =
      STATSBOMB_TEAM_MEDIAN_CATEGORY_LABELS[categoryId] ?? metric.categoryId;

    rows.push({
      metricId: metric.id,
      label: metric.label,
      description: metric.description,
      categoryId,
      categoryLabel,
      phase: metric.phase,
      median,
      matchValue,
      deviation,
      absDeviation,
      deviationPct,
      absDeviationPct,
      pctReliable,
    });
  }

  return rows;
}

function compareSortValues(
  a: string | number | null,
  b: string | number | null,
  direction: StatsBombMatchMedianDeviationSortDirection,
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

export function getMatchMedianDeviationSortValue(
  row: StatsBombMatchMedianDeviationRow,
  sortKey: StatsBombMatchMedianDeviationSortKey,
): string | number | null {
  switch (sortKey) {
    case "label":
      return row.label;
    case "categoryLabel":
      return row.categoryLabel;
    case "median":
      return row.median;
    case "matchValue":
      return row.matchValue;
    case "deviation":
      return row.deviation;
    case "deviationPct":
      return row.deviationPct;
    case "absDeviation":
      return row.absDeviation;
    case "absDeviationPct":
      return row.absDeviationPct;
    default:
      return null;
  }
}

export function sortStatsBombMatchMedianDeviations(
  rows: StatsBombMatchMedianDeviationRow[],
  sortKey: StatsBombMatchMedianDeviationSortKey = STATSBOMB_MATCH_MEDIAN_DEVIATION_DEFAULT_SORT,
  direction: StatsBombMatchMedianDeviationSortDirection = STATSBOMB_MATCH_MEDIAN_DEVIATION_DEFAULT_DIRECTION,
): StatsBombMatchMedianDeviationRow[] {
  return [...rows].sort((a, b) => {
    const primary = compareSortValues(
      getMatchMedianDeviationSortValue(a, sortKey),
      getMatchMedianDeviationSortValue(b, sortKey),
      direction,
    );
    if (primary !== 0) return primary;

    const fallback = compareSortValues(
      a.absDeviationPct ?? a.absDeviation,
      b.absDeviationPct ?? b.absDeviation,
      "desc",
    );
    if (fallback !== 0) return fallback;

    return a.label.localeCompare(b.label, "pl", { sensitivity: "base" });
  });
}

export function toggleMatchMedianDeviationSort(
  currentKey: StatsBombMatchMedianDeviationSortKey,
  currentDirection: StatsBombMatchMedianDeviationSortDirection,
  nextKey: StatsBombMatchMedianDeviationSortKey,
): {
  sortKey: StatsBombMatchMedianDeviationSortKey;
  direction: StatsBombMatchMedianDeviationSortDirection;
} {
  if (currentKey === nextKey) {
    return {
      sortKey: nextKey,
      direction: currentDirection === "asc" ? "desc" : "asc",
    };
  }

  const numericKeys: StatsBombMatchMedianDeviationSortKey[] = [
    "median",
    "matchValue",
    "deviation",
    "deviationPct",
    "absDeviation",
    "absDeviationPct",
  ];

  return {
    sortKey: nextKey,
    direction: numericKeys.includes(nextKey) ? "desc" : "asc",
  };
}

export function rankStatsBombMatchMedianDeviations(
  rows: StatsBombMatchMedianDeviationRow[],
  sortKey: StatsBombMatchMedianDeviationSortKey = STATSBOMB_MATCH_MEDIAN_DEVIATION_DEFAULT_SORT,
  direction: StatsBombMatchMedianDeviationSortDirection = STATSBOMB_MATCH_MEDIAN_DEVIATION_DEFAULT_DIRECTION,
  minAbsDeviation = 1e-12,
): StatsBombMatchMedianDeviationRow[] {
  return sortStatsBombMatchMedianDeviations(rows, sortKey, direction).filter(
    (row) => row.absDeviation > minAbsDeviation,
  );
}
