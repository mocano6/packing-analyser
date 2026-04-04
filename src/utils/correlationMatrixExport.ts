import type { CorrelationMatrixSortMode } from "./trendyKpis";

export const CORRELATION_MATRIX_EXPORT_SCHEMA_VERSION = 1 as const;

export type CorrelationKpiMatrixExportV1 = {
  schemaVersion: typeof CORRELATION_MATRIX_EXPORT_SCHEMA_VERSION;
  exportType: "packing-analyzer.correlationKpiMatrix";
  language: "pl";
  exportedAt: string;
  /** Krótki opis dla modeli LLM */
  description: string;
  sample: {
    /** Jedna obserwacja = jeden mecz (możliwie wiele zespołów w próbie) */
    unit: "match";
    matchCount: number;
    pearsonMinMatches: 3;
  };
  sortMode: CorrelationMatrixSortMode;
  /** Gdy sortowanie po kolumnie — metryka-„oś” (kolejność surowa przed permutacją). */
  columnSortReference?: {
    metricId: string;
    label: string;
    direction: "desc" | "asc";
  };
  scopeHint?: string;
  metrics: Array<{ index: number; id: string; label: string }>;
  /** Wiersze i kolumny w tej samej kolejności co metrics; wartości null = brak korelacji (np. stała seria). */
  pearsonRMatrix: (number | null)[][];
  /** Symetryczna mapa po id metryki (wygodna dla LLM bez indeksowania) */
  correlationsByMetricId: Record<string, Record<string, number | null>>;
  /** Wszystkie unikalne pary (i ≤ j), żeby łatwo filtrować w promptach */
  pairs: Array<{
    rowMetricId: string;
    colMetricId: string;
    rowLabel: string;
    colLabel: string;
    pearsonR: number | null;
  }>;
};

export function buildCorrelationKpiMatrixExportPayload(params: {
  exportedAt: string;
  matchCount: number;
  sortMode: CorrelationMatrixSortMode;
  columnSortReference?: CorrelationKpiMatrixExportV1["columnSortReference"];
  scopeHint?: string;
  metrics: { id: string; label: string }[];
  matrix: (number | null)[][];
}): CorrelationKpiMatrixExportV1 {
  const { exportedAt, matchCount, sortMode, columnSortReference, scopeHint, metrics, matrix } = params;
  const metricsIndexed = metrics.map((m, index) => ({ index, id: m.id, label: m.label }));

  const correlationsByMetricId: Record<string, Record<string, number | null>> = {};
  const pairs: CorrelationKpiMatrixExportV1["pairs"] = [];

  for (let i = 0; i < metrics.length; i += 1) {
    const ri = metrics[i].id;
    if (!correlationsByMetricId[ri]) correlationsByMetricId[ri] = {};
    for (let j = 0; j < metrics.length; j += 1) {
      const r = matrix[i]?.[j] ?? null;
      const cj = metrics[j].id;
      correlationsByMetricId[ri][cj] = r;
      if (i <= j) {
        pairs.push({
          rowMetricId: ri,
          colMetricId: cj,
          rowLabel: metrics[i].label,
          colLabel: metrics[j].label,
          pearsonR: r,
        });
      }
    }
  }

  return {
    schemaVersion: CORRELATION_MATRIX_EXPORT_SCHEMA_VERSION,
    exportType: "packing-analyzer.correlationKpiMatrix",
    language: "pl",
    exportedAt,
    description:
      "Macierz korelacji Pearsona między metrykami meczu: pearsonRMatrix[i][j] odpowiada metrics[i] vs metrics[j]. " +
      "Wartości od -1 do 1; null oznacza brak obliczenia (np. brak wariancji). Próba: N meczów, min. 3 do estymacji r.",
    sample: {
      unit: "match",
      matchCount,
      pearsonMinMatches: 3,
    },
    sortMode,
    ...(columnSortReference ? { columnSortReference } : {}),
    ...(scopeHint ? { scopeHint } : {}),
    metrics: metricsIndexed,
    pearsonRMatrix: matrix.map((row) => [...row]),
    correlationsByMetricId,
    pairs,
  };
}

export function correlationMatrixExportFilename(isoTimestamp: string): string {
  const safe = isoTimestamp.slice(0, 19).replace(/:/g, "-");
  return `correlation-kpi-matrix-${safe}.json`;
}
