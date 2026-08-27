import { formatKpiValue, TrendyKpiDirection, TrendyKpiUnit } from "./trendyKpis";

export type TrendyKpiTargetSummary = {
  matchCount: number;
  average: number;
  deltaFromTarget: number;
  hitCount: number;
  missCount: number;
  meetsTargetOnAverage: boolean;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Średnia z meczów vs target: trafienia, chybienia i odchylenie średniej od celu. */
export function summarizeKpiVsTarget(
  values: unknown[],
  target: number,
  direction: TrendyKpiDirection,
): TrendyKpiTargetSummary {
  const finite = values.filter(isFiniteNumber);
  const matchCount = finite.length;
  const average = matchCount > 0 ? finite.reduce((sum, value) => sum + value, 0) / matchCount : 0;
  const hitCount =
    direction === "higher"
      ? finite.filter((value) => value >= target).length
      : finite.filter((value) => value <= target).length;

  return {
    matchCount,
    average,
    deltaFromTarget: average - target,
    hitCount,
    missCount: matchCount - hitCount,
    meetsTargetOnAverage:
      matchCount > 0 && (direction === "higher" ? average >= target : average <= target),
  };
}

/** Etykieta: średnia powyżej / poniżej celu (albo równa celowi). */
export function formatKpiAverageVsTargetLabel(
  deltaFromTarget: number,
  unit: TrendyKpiUnit,
  referenceLabel = "celu",
): string {
  const absDelta = Math.abs(deltaFromTarget);
  const formattedAbs = formatKpiValue(absDelta, unit);
  if (formattedAbs === formatKpiValue(0, unit)) return `= ${referenceLabel}`;
  if (deltaFromTarget > 0) return `${formattedAbs} powyżej ${referenceLabel}`;
  return `${formattedAbs} poniżej ${referenceLabel}`;
}

export function formatTrendyKpiHitMissLabel(hitCount: number, missCount: number): string {
  return `osiągnięty ${hitCount}× · nie ${missCount}×`;
}

export function formatTrendyKpiHeaderAverageLine(
  summary: TrendyKpiTargetSummary,
  unit: TrendyKpiUnit,
): string {
  return `śr. ${formatKpiValue(summary.average, unit)} · ${formatKpiAverageVsTargetLabel(summary.deltaFromTarget, unit)}`;
}
