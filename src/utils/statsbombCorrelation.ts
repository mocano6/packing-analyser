import type { CorrelationMatrixAxisSide } from "./correlationMatrixAxis";
import { buildPearsonCorrelationMatrix } from "./trendyKpis";
import type { StatsBombMatchRow } from "./statsbombCsvParser";
import { getStatsBombMetricDefinition } from "./statsbombMetricDefinitions";

export type StatsBombMetric = {
  id: string;
  label: string;
  axisSide: CorrelationMatrixAxisSide;
  getValue: (row: StatsBombMatchRow) => number;
  /** Tooltip z glossary Wyscout/StatsBomb (jeśli dostępny). */
  description?: string;
};

export type StatsBombCorrelationResult = {
  metrics: StatsBombMetric[];
  matrix: (number | null)[][];
};

const OUTCOME_METRICS: StatsBombMetric[] = [
  {
    id: "sb_win",
    label: "Wygrana",
    axisSide: "outcome",
    getValue: (r) => r.outcomes.win,
    description: getStatsBombMetricDefinition("Wygrana", "sb_win"),
  },
  {
    id: "sb_draw",
    label: "Remis",
    axisSide: "outcome",
    getValue: (r) => r.outcomes.draw,
    description: getStatsBombMetricDefinition("Remis", "sb_draw"),
  },
  {
    id: "sb_loss",
    label: "Przegrana",
    axisSide: "outcome",
    getValue: (r) => r.outcomes.loss,
    description: getStatsBombMetricDefinition("Przegrana", "sb_loss"),
  },
  {
    id: "sb_points",
    label: "Punkty",
    axisSide: "outcome",
    getValue: (r) => r.outcomes.points,
    description: getStatsBombMetricDefinition("Punkty", "sb_points"),
  },
  {
    id: "sb_gd",
    label: "GD",
    axisSide: "my",
    getValue: (r) => r.outcomes.gd,
    description: getStatsBombMetricDefinition("GD", "sb_gd"),
  },
  {
    id: "sb_xgd",
    label: "xGD",
    axisSide: "my",
    getValue: (r) => r.outcomes.xgd,
    description: getStatsBombMetricDefinition("xGD", "sb_xgd"),
  },
  {
    id: "sb_goals",
    label: "Gole",
    axisSide: "my",
    getValue: (r) => r.outcomes.goals,
    description: getStatsBombMetricDefinition("Gole", "sb_goals"),
  },
  {
    id: "sb_goals_conceded",
    label: "Gole stracone",
    axisSide: "opp",
    getValue: (r) => r.outcomes.goalsConceded,
    description: getStatsBombMetricDefinition("Gole stracone", "sb_goals_conceded"),
  },
  {
    id: "sb_xg",
    label: "xG",
    axisSide: "my",
    getValue: (r) => r.outcomes.xg,
    description: getStatsBombMetricDefinition("Cumulative xG", "sb_xg"),
  },
  {
    id: "sb_xga",
    label: "xGA",
    axisSide: "opp",
    getValue: (r) => r.outcomes.xga,
    description: getStatsBombMetricDefinition("Opposition xG", "sb_xga"),
  },
];

/** Unikalne id kolumny CSV — % musi zostać rozróżnione (np. „Shots” vs „Shots%”). */
export function metricIdFromColumn(column: string): string {
  const slug = column
    .trim()
    .replace(/%/g, "_pct")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return `sb_col_${slug}`;
}

/** Metryki liczbowe z CSV (bez duplikatów względem outcome). */
export function getStatsBombCsvColumnMetrics(rows: StatsBombMatchRow[]): StatsBombMetric[] {
  const outcomeKeys = new Set([
    "Goals & Penalty Goals",
    "Goals Conceded",
    "Cumulative xG",
    "Opposition xG",
  ]);
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row.numeric)) {
      if (!outcomeKeys.has(key)) keys.add(key);
    }
  }
  return [...keys]
    .sort((a, b) => a.localeCompare(b, "pl", { sensitivity: "base" }))
    .map((column) => {
      const label = column.trim();
      return {
        id: metricIdFromColumn(column),
        label,
        axisSide: "neutral" as const,
        getValue: (row: StatsBombMatchRow) => row.numeric[column] ?? 0,
        description: getStatsBombMetricDefinition(label),
      };
    });
}

export function getStatsBombMetricsFull(rows: StatsBombMatchRow[]): StatsBombMetric[] {
  return [...OUTCOME_METRICS, ...getStatsBombCsvColumnMetrics(rows)];
}

export function buildStatsBombCorrelation(
  rows: StatsBombMatchRow[],
  minSamples = 3,
): StatsBombCorrelationResult | null {
  const metrics = getStatsBombMetricsFull(rows);
  if (rows.length < minSamples || metrics.length === 0) return null;

  const columns = metrics.map((m) => rows.map((r) => m.getValue(r)));
  // W MatchStats zero to zwykle prawdziwa wartość (0 goli, 0 pressów), nie brak danych.
  const matrix = buildPearsonCorrelationMatrix(columns, minSamples, {
    omitZeroValues: false,
    binaryIndicatorColumnIndices: new Set([0, 1, 2]),
  });

  return { metrics, matrix };
}
