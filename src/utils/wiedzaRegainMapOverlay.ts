import type { RegainPostWindowAgg, RegainPostWindowSec } from "./wiedzaRegainPostWindowByZone";

const POST_MAP_METRIC_SHORT_LABEL: Record<keyof RegainPostWindowAgg, string> = {
  eligibleRegains: "n",
  totalPk: "PK",
  totalXg: "xG",
  totalPxt: "PxT",
  totalXtDelta: "ΣΔxT",
  totalPackingPoints: "Σ pkt",
};

/** Liczba miejsc po przecinku na heatmapie dla metryki z tabeli „czyste okno”. */
export function regainPostMapMetricFractionDigits(metric: keyof RegainPostWindowAgg): number {
  if (metric === "eligibleRegains" || metric === "totalPk" || metric === "totalPackingPoints") return 0;
  return 3;
}

/** Etykieta tooltipa / legendy na mapie. */
export function regainPostMapMetricLabel(metric: keyof RegainPostWindowAgg, windowSec: RegainPostWindowSec): string {
  const short = POST_MAP_METRIC_SHORT_LABEL[metric];
  return `${short} · ${windowSec}s (czyste okno)`;
}
