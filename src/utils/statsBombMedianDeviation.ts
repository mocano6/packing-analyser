import type { StatsBombDistributionStats } from "./statsBombMedianDistribution";

/** Minimalna skala odniesienia dla procentów (unikamy dzielenia przez ~0). */
const MIN_PCT_BASELINE = 1e-6;

/**
 * Skala odniesienia dla odchylenia % względem mediany sezonu.
 * Przy rozkładach z wieloma zerami (q1=0) używa szerszej skali (Q3 / IQR),
 * żeby pojedyncze zera nie dawały sztucznego −100%.
 */
export function statsBombDeviationPctBaseline(
  stats: Pick<StatsBombDistributionStats, "median" | "q1" | "q3" | "mean">,
): number | null {
  const absMedian = Math.abs(stats.median);
  const absQ1 = Math.abs(stats.q1);
  const absQ3 = Math.abs(stats.q3);
  const absMean = Math.abs(stats.mean);
  const iqr = Math.abs(stats.q3 - stats.q1);

  if (absMedian >= MIN_PCT_BASELINE) {
    if (absQ1 < MIN_PCT_BASELINE && absQ3 > absMedian * 1.25) {
      return Math.max(absMedian, absQ3, iqr, MIN_PCT_BASELINE);
    }
    return absMedian;
  }

  if (absQ3 >= MIN_PCT_BASELINE) return absQ3;
  if (iqr >= MIN_PCT_BASELINE) return iqr;
  if (absMean >= MIN_PCT_BASELINE) return absMean;
  return null;
}

export function computeStatsBombDeviationPct(
  value: number,
  seasonMedian: number,
  stats: Pick<StatsBombDistributionStats, "median" | "q1" | "q3" | "mean">,
): number | null {
  if (!Number.isFinite(value)) return null;
  const baseline = statsBombDeviationPctBaseline(stats);
  if (baseline === null) return null;
  return ((value - seasonMedian) / baseline) * 100;
}

export function isStatsBombDeviationPctReliable(
  stats: Pick<StatsBombDistributionStats, "median" | "q1" | "q3" | "mean" | "count">,
  values: number[],
): boolean {
  const baseline = statsBombDeviationPctBaseline(stats);
  if (baseline === null || baseline < MIN_PCT_BASELINE) return false;

  if (values.length === 0) return false;

  const zeroCount = values.filter((value) => Math.abs(value) < MIN_PCT_BASELINE).length;
  const zeroRate = zeroCount / values.length;
  const absQ1 = Math.abs(stats.q1);
  const absMedian = Math.abs(stats.median);
  const absQ3 = Math.abs(stats.q3);

  // Mediana = 0 i większość meczów bez zdarzenia → % vs sezonu mało sensowne
  if (absMedian < MIN_PCT_BASELINE && zeroRate >= 0.5) {
    return false;
  }

  // q1=0 i co najmniej ¼ meczów bez zdarzenia — typowe xG/SF z wieloma zerami
  if (absQ1 < MIN_PCT_BASELINE && zeroRate >= 0.25) {
    return false;
  }

  // Mediana > 0, ale rozkład silnie „zero-inflated” (skala % oparta o Q3 zamiast mediany)
  if (absQ1 < MIN_PCT_BASELINE && absQ3 > absMedian * 1.25 && zeroRate >= 0.15) {
    return false;
  }

  return true;
}

/** Średnie odchylenie % grupy — liczone od średniej wartości grupy, nie średniej % per mecz. */
export function aggregateGroupDeviationPct(
  avgValue: number | null,
  seasonMedian: number,
  stats: Pick<StatsBombDistributionStats, "median" | "q1" | "q3" | "mean">,
): number | null {
  if (avgValue === null || !Number.isFinite(avgValue)) return null;
  return computeStatsBombDeviationPct(avgValue, seasonMedian, stats);
}
