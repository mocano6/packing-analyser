/**
 * Oś macierzy korelacji: kolor nagłówków wierszy/kolumn (nasz klub vs przeciwnik vs wynik).
 */
export type CorrelationMatrixAxisSide = "outcome" | "my" | "opp" | "neutral";

export type CorrelationAxisHeadStyles = {
  headAxisOutcome: string;
  headAxisMy: string;
  headAxisOpp: string;
  headAxisNeutral: string;
};

export function correlationAxisHeadClass(
  side: CorrelationMatrixAxisSide,
  styles: CorrelationAxisHeadStyles,
): string {
  switch (side) {
    case "outcome":
      return styles.headAxisOutcome;
    case "my":
      return styles.headAxisMy;
    case "opp":
      return styles.headAxisOpp;
    default:
      return styles.headAxisNeutral;
  }
}

/** KPI z listy trendów w macierzy KPI — większość z perspektywy klubu; wyjątki oznaczone osobno. */
export function trendyKpiCorrelationAxisSide(kpiId: string): CorrelationMatrixAxisSide {
  if (kpiId === "pk_opponent") return "opp";
  return "my";
}
