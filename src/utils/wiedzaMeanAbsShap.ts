import type { TeamInfo } from "../types";
import type { WiedzaWeightsMetric } from "./wiedzaWeightsMetrics";

/** Kara grzbietowa na cechach standaryzowanych (przekątna X'X ma rząd n). */
const RIDGE_LAMBDA = 1;
const MIN_SAMPLES = 6;
const VARIANCE_EPS = 1e-9;

export type WiedzaMeanAbsShapRow = {
  id: string;
  /** Średni moduł wkładu SHAP w jednostkach metryki referencyjnej. */
  meanAbsShap: number;
  /** Znak współczynnika: +1 gdy wyższa wartość cechy podnosi prognozę. */
  direction: 1 | -1;
};

export type WiedzaMeanAbsShapPreview = {
  targetId: string;
  n: number;
  featureCount: number;
  r2: number;
  rows: WiedzaMeanAbsShapRow[];
};

type FeatureSeries = {
  id: string;
  values: number[];
};

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: number[], avg: number): number {
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function pearson(x: number[], y: number[]): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 3) return null;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;
  for (let i = 0; i < n; i += 1) {
    const xi = x[i];
    const yi = y[i];
    sumX += xi;
    sumY += yi;
    sumXY += xi * yi;
    sumXX += xi * xi;
    sumYY += yi * yi;
  }
  const num = n * sumXY - sumX * sumY;
  const denom = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
  if (denom === 0 || !Number.isFinite(denom)) return null;
  const r = num / denom;
  return Number.isFinite(r) ? r : null;
}

/** Rozwiązanie Ax = b (eliminacja Gaussa z częściowym wyborem elementu głównego). */
function solveLinearSystem(matrix: number[][], rhs: number[]): number[] | null {
  const n = rhs.length;
  const a = matrix.map((row, index) => [...row, rhs[index]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    let maxAbs = Math.abs(a[col][col]);
    for (let row = col + 1; row < n; row += 1) {
      const value = Math.abs(a[row][col]);
      if (value > maxAbs) {
        maxAbs = value;
        pivot = row;
      }
    }
    if (maxAbs < 1e-12) return null;
    if (pivot !== col) {
      const swap = a[col];
      a[col] = a[pivot];
      a[pivot] = swap;
    }
    const divisor = a[col][col];
    for (let j = col; j <= n; j += 1) a[col][j] /= divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = a[row][col];
      if (factor === 0) continue;
      for (let j = col; j <= n; j += 1) a[row][j] -= factor * a[col][j];
    }
  }
  return a.map((row) => row[n]);
}

/**
 * Ile cech wchodzi do modelu przy danej próbie.
 * Sufit n/2 trzyma regresję poniżej nasycenia, gdy metryk jest więcej niż meczów.
 */
export function maxShapFeaturesForSample(sampleSize: number): number {
  return Math.max(1, Math.floor((sampleSize - 1) / 2));
}

/**
 * mean(|SHAP value|) liniowego modelu grzbietowego.
 * Dla modelu liniowego na cechach scentrowanych φ_i = β_i · z_i, więc średni moduł
 * to |β_i| · mean(|z_i|) w jednostkach metryki referencyjnej.
 * Przy p > n do modelu wchodzą cechy o najsilniejszej |r| z celem.
 */
export function buildMeanAbsShapPreview(
  targetId: string,
  y: number[],
  features: FeatureSeries[],
): WiedzaMeanAbsShapPreview | null {
  const n = y.length;
  if (n < MIN_SAMPLES || features.length === 0) return null;
  if (y.some((value) => !Number.isFinite(value))) return null;

  const yMean = mean(y);
  const ySd = stdDev(y, yMean);
  if (ySd < VARIANCE_EPS) return null;
  const yCentered = y.map((value) => value - yMean);

  const usable = features.flatMap((feature) => {
    if (feature.id === targetId || feature.values.length !== n) return [];
    if (feature.values.some((value) => !Number.isFinite(value))) return [];
    const avg = mean(feature.values);
    const sd = stdDev(feature.values, avg);
    if (sd < VARIANCE_EPS) return [];
    const r = pearson(feature.values, y);
    if (r === null) return [];
    return [{ feature, avg, sd, absR: Math.abs(r) }];
  });
  if (usable.length === 0) return null;

  usable.sort((a, b) => b.absR - a.absR || a.feature.id.localeCompare(b.feature.id));
  const selected = usable.slice(0, Math.min(usable.length, maxShapFeaturesForSample(n)));
  const k = selected.length;
  const z = y.map((_, row) => selected.map((col) => (col.feature.values[row] - col.avg) / col.sd));

  const xtx = Array.from({ length: k }, () => Array<number>(k).fill(0));
  const xty = Array<number>(k).fill(0);
  for (let row = 0; row < n; row += 1) {
    for (let i = 0; i < k; i += 1) {
      xty[i] += z[row][i] * yCentered[row];
      for (let j = i; j < k; j += 1) xtx[i][j] += z[row][i] * z[row][j];
    }
  }
  for (let i = 0; i < k; i += 1) {
    for (let j = 0; j < i; j += 1) xtx[i][j] = xtx[j][i];
    xtx[i][i] += RIDGE_LAMBDA;
  }

  const beta = solveLinearSystem(xtx, xty);
  if (!beta) return null;

  let ssTot = 0;
  let ssRes = 0;
  for (let row = 0; row < n; row += 1) {
    let prediction = 0;
    for (let i = 0; i < k; i += 1) prediction += beta[i] * z[row][i];
    ssTot += yCentered[row] ** 2;
    ssRes += (yCentered[row] - prediction) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  const rows: WiedzaMeanAbsShapRow[] = [];
  for (let i = 0; i < k; i += 1) {
    if (Math.abs(beta[i]) < 1e-8) continue;
    let meanAbsZ = 0;
    for (let row = 0; row < n; row += 1) meanAbsZ += Math.abs(z[row][i]);
    meanAbsZ /= n;
    rows.push({
      id: selected[i].feature.id,
      meanAbsShap: Math.abs(beta[i]) * meanAbsZ,
      direction: beta[i] >= 0 ? 1 : -1,
    });
  }
  if (rows.length === 0) return null;

  return {
    targetId,
    n,
    featureCount: rows.length,
    r2: Number.isFinite(r2) ? r2 : 0,
    rows,
  };
}

/** mean(|SHAP value|) dla wybranej metryki referencyjnej na próbie meczów. */
export function buildWiedzaMeanAbsShapPreview(
  matches: TeamInfo[],
  metrics: WiedzaWeightsMetric[],
  targetId: string,
): WiedzaMeanAbsShapPreview | null {
  const target = metrics.find((metric) => metric.id === targetId);
  if (!target) return null;
  return buildMeanAbsShapPreview(
    targetId,
    matches.map((match) => target.getValue(match)),
    metrics.map((metric) => ({
      id: metric.id,
      values: matches.map((match) => metric.getValue(match)),
    })),
  );
}
