import type { StatsBombMatchRow } from "./statsbombCsvParser";
import {
  buildStatsBombCorrelation,
  type StatsBombMetric,
} from "./statsbombCorrelation";
import {
  classifyStatsBombReportPhase,
  statsBombPhaseLabel,
  type StatsBombReportPhase,
} from "./statsBombTeamReport";
import type {
  StatsBombScoutingComputation,
  StatsBombScoutingPoolRow,
} from "./statsBombPlayerScouting";
import {
  collectSquadMetricColumns,
  resolveScoutingMetricColumn,
} from "./statsBombPlayerScouting";
import type { StatsBombScoutingCriterion } from "./statsBombScoutingProfiles";
import { isLowerBetterPlayerMetric } from "./statsBombPlayerReport";

/** Minimalna dodatnia r z metryką referencyjną, aby wliczyć kryterium do ważonego profilu. */
export const STATSBOMB_SCOUTING_CORR_MIN_ABS_R = 0.15;

export const STATSBOMB_SCOUTING_DEFAULT_REFERENCE_METRIC_ID = "sb_points";

export type MatchMetricPointsCorrelation = {
  label: string;
  rPoints: number | null;
  phase: StatsBombReportPhase;
};

export type StatsBombScoutingCriterionWeight = {
  criterionId: string;
  criterionLabel: string;
  phase: StatsBombReportPhase;
  playerMetricLabel: string | null;
  matchMetricLabel: string | null;
  rPoints: number | null;
  weight: number;
  higherIsBetter: boolean;
  status:
    | "weighted"
    | "weak_correlation"
    | "negative_correlation"
    | "missing_match_data"
    | "missing_player_metric";
};

export type StatsBombScoutingWeightedCriterionScore = {
  criterionId: string;
  criterionLabel: string;
  phase: StatsBombReportPhase;
  metricLabel: string | null;
  playerValue: number | null;
  percentile: number | null;
  effectivePercentile: number | null;
  rPoints: number | null;
  weight: number;
  weightedContribution: number | null;
  higherIsBetter: boolean;
  status: StatsBombScoutingCriterionWeight["status"];
};

export type StatsBombScoutingWeightedPhaseSummary = {
  phase: StatsBombReportPhase;
  totalWeight: number;
  weightedAvgPercentile: number | null;
  criterionCount: number;
};

export type StatsBombScoutingCorrelationWeightsReport = {
  matchCount: number;
  referenceMetricId: string;
  referenceMetricLabel: string;
  criterionWeights: StatsBombScoutingCriterionWeight[];
  totalActiveWeight: number;
  attackWeightShare: number | null;
  defenseWeightShare: number | null;
};

export type StatsBombScoutingWeightedPoolRow = StatsBombScoutingPoolRow & {
  weightedFitPercentile: number | null;
  attackWeightedPercentile: number | null;
  defenseWeightedPercentile: number | null;
};

function normalizeColumnKey(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

function collectMatchMetricColumns(matchRows: StatsBombMatchRow[]): string[] {
  const keys = new Set<string>();
  for (const row of matchRows) {
    for (const key of Object.keys(row.numeric)) {
      keys.add(key);
    }
  }
  return [...keys];
}

function resolveHigherIsBetter(metricLabel: string): boolean {
  return !isLowerBetterPlayerMetric(metricLabel);
}

function resolveHigherIsBetterForCriterion(
  criterion: StatsBombScoutingCriterion,
  metricLabel: string,
): boolean {
  if (criterion.higherIsBetter !== undefined) return criterion.higherIsBetter;
  return resolveHigherIsBetter(metricLabel);
}

/** Skuteczna siła korelacji do wag: dla «mniej = lepiej» oczekujemy ujemnej r. */
export function scoutingCorrelationEffectiveWeight(
  rPoints: number,
  higherIsBetter: boolean,
): number {
  return higherIsBetter ? rPoints : -rPoints;
}

/** Metryki dostępne jako oś korelacji dla wag scoutingowych. */
export function listScoutingCorrelationReferenceMetrics(
  matchRows: StatsBombMatchRow[],
  minSamples = 3,
): StatsBombMetric[] {
  return buildStatsBombCorrelation(matchRows, minSamples)?.metrics ?? [];
}

/** Mapuje kolumny MatchStats → korelacja Pearsona z wybraną metryką referencyjną. */
export function buildMatchMetricReferenceCorrelations(
  matchRows: StatsBombMatchRow[],
  referenceMetricId: string,
  minSamples = 3,
): Map<string, MatchMetricPointsCorrelation> {
  const data = buildStatsBombCorrelation(matchRows, minSamples);
  const map = new Map<string, MatchMetricPointsCorrelation>();
  if (!data) return map;

  const referenceIdx = data.metrics.findIndex((metric) => metric.id === referenceMetricId);
  if (referenceIdx < 0) return map;

  for (let i = 0; i < data.metrics.length; i++) {
    const metric = data.metrics[i];
    if (metric.id === referenceMetricId) continue;

    const rReference = data.matrix[i]?.[referenceIdx] ?? null;
    map.set(normalizeColumnKey(metric.label), {
      label: metric.label,
      rPoints: rReference === null || !Number.isFinite(rReference) ? null : rReference,
      phase: classifyStatsBombReportPhase(metric.label, metric.axisSide),
    });
  }

  return map;
}

/** @deprecated Użyj buildMatchMetricReferenceCorrelations z referenceMetricId. */
export function buildMatchMetricPointsCorrelations(
  matchRows: StatsBombMatchRow[],
  minSamples = 3,
): Map<string, MatchMetricPointsCorrelation> {
  return buildMatchMetricReferenceCorrelations(
    matchRows,
    STATSBOMB_SCOUTING_DEFAULT_REFERENCE_METRIC_ID,
    minSamples,
  );
}

function resolveMatchCorrelationForPlayerMetric(
  playerMetricLabel: string,
  matchCorrelations: Map<string, MatchMetricPointsCorrelation>,
  matchColumns: string[],
): MatchMetricPointsCorrelation | null {
  const normalizedAvailable = new Map(
    matchColumns.map((col) => [normalizeColumnKey(col), col]),
  );

  const direct = matchCorrelations.get(normalizeColumnKey(playerMetricLabel));
  if (direct) return direct;

  const columnMatch = normalizedAvailable.get(normalizeColumnKey(playerMetricLabel));
  if (columnMatch) {
    return matchCorrelations.get(normalizeColumnKey(columnMatch)) ?? null;
  }

  return null;
}

export type ScoutingMetricCorrelationPick = {
  metricLabel: string | null;
  matchCorrelation: MatchMetricPointsCorrelation | null;
};

/**
 * Spośród kandydatów kryterium wybiera metrykę z najwyższą |r| z punktami w MatchStats
 * (wymaga obecności kolumny w eksporcie gracza i meczu).
 */
export function resolveScoutingMetricByPointsCorrelation(
  criterion: StatsBombScoutingCriterion,
  availableColumns: string[],
  matchCorrelations: Map<string, MatchMetricPointsCorrelation>,
  matchColumns: string[],
): ScoutingMetricCorrelationPick {
  let bestMetric: string | null = null;
  let bestCorrelation: MatchMetricPointsCorrelation | null = null;
  let bestAbsR = -1;

  for (const candidate of criterion.metricCandidates) {
    const resolved = resolveScoutingMetricColumn([candidate], availableColumns);
    if (!resolved) continue;

    const matchCorrelation = resolveMatchCorrelationForPlayerMetric(
      resolved,
      matchCorrelations,
      matchColumns,
    );
    if (!matchCorrelation || matchCorrelation.rPoints === null) continue;

    const absR = Math.abs(matchCorrelation.rPoints);
    if (absR > bestAbsR) {
      bestAbsR = absR;
      bestMetric = resolved;
      bestCorrelation = matchCorrelation;
    }
  }

  return { metricLabel: bestMetric, matchCorrelation: bestCorrelation };
}

/**
 * Wybór metryki do wag: najwyższa skuteczna korelacja z metryką referencyjną.
 * Dla metryk «więcej = lepiej» — dodatnia r; dla «mniej = lepiej» — ujemna r (waga = |r|).
 */
export function resolveScoutingMetricForWeighting(
  criterion: StatsBombScoutingCriterion,
  availableColumns: string[],
  matchCorrelations: Map<string, MatchMetricPointsCorrelation>,
  matchColumns: string[],
): ScoutingMetricCorrelationPick {
  let bestMetric: string | null = null;
  let bestCorrelation: MatchMetricPointsCorrelation | null = null;
  let bestEffectiveWeight = -Infinity;

  for (const candidate of criterion.metricCandidates) {
    const resolved = resolveScoutingMetricColumn([candidate], availableColumns);
    if (!resolved) continue;

    const matchCorrelation = resolveMatchCorrelationForPlayerMetric(
      resolved,
      matchCorrelations,
      matchColumns,
    );
    if (!matchCorrelation || matchCorrelation.rPoints === null) continue;

    const higherIsBetter = resolveHigherIsBetterForCriterion(criterion, resolved);
    const effectiveWeight = scoutingCorrelationEffectiveWeight(
      matchCorrelation.rPoints,
      higherIsBetter,
    );

    if (effectiveWeight > bestEffectiveWeight) {
      bestEffectiveWeight = effectiveWeight;
      bestMetric = resolved;
      bestCorrelation = matchCorrelation;
    }
  }

  return { metricLabel: bestMetric, matchCorrelation: bestCorrelation };
}

export function computeScoutingWeightShare(
  weight: number,
  totalActiveWeight: number,
): number | null {
  if (weight <= 0 || totalActiveWeight <= 0) return null;
  return (weight / totalActiveWeight) * 100;
}

export function describeScoutingWeightImpact(
  row: StatsBombScoutingCriterionWeight,
  referenceLabel: string,
  matchCount: number,
): string {
  if (row.status === "missing_player_metric") {
    return "Brak kolumny w eksporcie PlayerScout — kryterium nie wpływa na ranking.";
  }
  if (row.status === "missing_match_data") {
    return "Brak tej metryki w MatchStats — nie można policzyć korelacji z wynikiem.";
  }
  if (row.status === "negative_correlation") {
    const r = row.rPoints ?? 0;
    const directionHint = row.higherIsBetter
      ? "Korelacje ujemne nie są doliczane do rankingu."
      : "Dla metryki «mniej = lepiej» oczekiwana jest ujemna r z wynikiem — dodatnia korelacja nie wspiera kryterium.";
    return (
      `W ${matchCount} meczach wyższe ${row.matchMetricLabel ?? "wartości"} szło z gorszym ${referenceLabel} ` +
      `(r = ${r.toFixed(2)}). ${directionHint}`
    );
  }
  if (row.status === "weak_correlation") {
    const r = row.rPoints ?? 0;
    return (
      `r = ${r >= 0 ? "+" : ""}${r.toFixed(2)} z ${referenceLabel} — poniżej progu ` +
      `${STATSBOMB_SCOUTING_CORR_MIN_ABS_R} dla dodatnich korelacji.`
    );
  }
  if (row.status !== "weighted" || row.rPoints === null || row.weight <= 0) {
    return "Kryterium pominięte w rankingu ważonym.";
  }

  const direction =
    row.higherIsBetter !== false
      ? "Premiuje kandydatów z wyższym percentylem tej metryki."
      : "Premiuje kandydatów z niższym percentylem (metryka: mniej = lepiej).";

  if (!row.higherIsBetter && row.rPoints < 0) {
    return (
      `W ${matchCount} meczach więcej ${row.matchMetricLabel ?? "wartości"} wiązało się z gorszym ${referenceLabel} ` +
      `(r = ${row.rPoints.toFixed(2)}). Dla metryki «mniej = lepiej» ujemna r jest oczekiwana — waga = |r| = ${row.weight.toFixed(2)}. ` +
      `Wkład do dopasowania = waga × skuteczny percentyl. ${direction}`
    );
  }

  return (
    `W ${matchCount} meczach wyższe ${row.matchMetricLabel ?? "wartości"} wiązało się z lepszym ${referenceLabel} ` +
    `(r = +${row.rPoints.toFixed(2)}). Waga = r. Wkład do dopasowania = waga × skuteczny percentyl. ${direction}`
  );
}

export function buildScoutingCriterionWeights(
  computation: StatsBombScoutingComputation,
  matchRows: StatsBombMatchRow[],
  referenceMetricId: string = STATSBOMB_SCOUTING_DEFAULT_REFERENCE_METRIC_ID,
  minSamples = 3,
): StatsBombScoutingCorrelationWeightsReport | null {
  if (matchRows.length < minSamples) return null;

  const referenceMetrics = listScoutingCorrelationReferenceMetrics(matchRows, minSamples);
  const referenceMetric =
    referenceMetrics.find((metric) => metric.id === referenceMetricId) ?? referenceMetrics[0];
  if (!referenceMetric) return null;

  const matchCorrelations = buildMatchMetricReferenceCorrelations(
    matchRows,
    referenceMetric.id,
    minSamples,
  );
  const matchColumns = collectMatchMetricColumns(matchRows);
  const availableColumns = collectSquadMetricColumns(computation.players);

  const criterionWeights: StatsBombScoutingCriterionWeight[] =
    computation.criterionMetrics.map(({ criterion }) => {
      const { metricLabel, matchCorrelation } = resolveScoutingMetricForWeighting(
        criterion,
        availableColumns,
        matchCorrelations,
        matchColumns,
      );

      if (!metricLabel) {
        return {
          criterionId: criterion.id,
          criterionLabel: criterion.label,
          phase: criterion.phase,
          playerMetricLabel: null,
          matchMetricLabel: null,
          rPoints: null,
          weight: 0,
          higherIsBetter: true,
          status: "missing_player_metric",
        };
      }

      const higherIsBetter =
        criterion.higherIsBetter !== undefined
          ? criterion.higherIsBetter
          : resolveHigherIsBetter(metricLabel);

      if (!matchCorrelation || matchCorrelation.rPoints === null) {
        return {
          criterionId: criterion.id,
          criterionLabel: criterion.label,
          phase: criterion.phase,
          playerMetricLabel: metricLabel,
          matchMetricLabel: matchCorrelation?.label ?? null,
          rPoints: null,
          weight: 0,
          higherIsBetter,
          status: "missing_match_data",
        };
      }

      const rPoints = matchCorrelation.rPoints;
      const effectiveWeight = scoutingCorrelationEffectiveWeight(rPoints, higherIsBetter);

      if (effectiveWeight <= 0) {
        return {
          criterionId: criterion.id,
          criterionLabel: criterion.label,
          phase: criterion.phase,
          playerMetricLabel: metricLabel,
          matchMetricLabel: matchCorrelation.label,
          rPoints,
          weight: 0,
          higherIsBetter,
          status: "negative_correlation",
        };
      }

      if (effectiveWeight < STATSBOMB_SCOUTING_CORR_MIN_ABS_R) {
        return {
          criterionId: criterion.id,
          criterionLabel: criterion.label,
          phase: criterion.phase,
          playerMetricLabel: metricLabel,
          matchMetricLabel: matchCorrelation.label,
          rPoints,
          weight: 0,
          higherIsBetter,
          status: "weak_correlation",
        };
      }

      return {
        criterionId: criterion.id,
        criterionLabel: criterion.label,
        phase: criterion.phase,
        playerMetricLabel: metricLabel,
        matchMetricLabel: matchCorrelation.label,
        rPoints,
        weight: effectiveWeight,
        higherIsBetter,
        status: "weighted",
      };
    });

  const totalActiveWeight = criterionWeights.reduce((sum, row) => sum + row.weight, 0);
  const attackWeight = criterionWeights
    .filter((row) => row.phase === "attack")
    .reduce((sum, row) => sum + row.weight, 0);
  const defenseWeight = criterionWeights
    .filter((row) => row.phase === "defense")
    .reduce((sum, row) => sum + row.weight, 0);

  return {
    matchCount: matchRows.length,
    referenceMetricId: referenceMetric.id,
    referenceMetricLabel: referenceMetric.label,
    criterionWeights,
    totalActiveWeight,
    attackWeightShare: totalActiveWeight > 0 ? attackWeight / totalActiveWeight : null,
    defenseWeightShare: totalActiveWeight > 0 ? defenseWeight / totalActiveWeight : null,
  };
}

export function effectivePercentileForTeamCorrelation(
  percentile: number,
  rPoints: number,
  higherIsBetter: boolean,
): number {
  const teamWantsMore = rPoints >= 0;
  const playerHighIsGood = higherIsBetter;
  const aligned = teamWantsMore === playerHighIsGood;
  return aligned ? percentile : 100 - percentile;
}

export function buildWeightedScoutingCriterionScores(
  computation: StatsBombScoutingComputation,
  playerId: string,
  weightsReport: StatsBombScoutingCorrelationWeightsReport,
): StatsBombScoutingWeightedCriterionScore[] {
  const weightByCriterion = new Map(
    weightsReport.criterionWeights.map((row) => [row.criterionId, row]),
  );

  return computation.criterionMetrics.map(({ criterion }) => {
    const weightRow = weightByCriterion.get(criterion.id)!;
    const selectedMetric = weightRow.playerMetricLabel;
    const pool = selectedMetric ? computation.metricPools.get(selectedMetric) : undefined;
    const playerValue = selectedMetric
      ? computation.players.find((p) => p.playerId === playerId)?.numeric[selectedMetric]
      : undefined;
    const value = Number.isFinite(playerValue) ? playerValue! : null;
    const percentile = selectedMetric
      ? (pool?.percentileByPlayerId.get(playerId) ?? null)
      : null;

    if (
      weightRow.status !== "weighted" ||
      percentile === null ||
      weightRow.rPoints === null ||
      weightRow.weight <= 0
    ) {
      return {
        criterionId: criterion.id,
        criterionLabel: criterion.label,
        phase: criterion.phase,
        metricLabel: selectedMetric,
        playerValue: value,
        percentile,
        effectivePercentile: null,
        rPoints: weightRow.rPoints,
        weight: weightRow.weight,
        weightedContribution: null,
        higherIsBetter: weightRow.higherIsBetter,
        status: weightRow.status,
      };
    }

    const effectivePercentile = effectivePercentileForTeamCorrelation(
      percentile,
      weightRow.rPoints,
      weightRow.higherIsBetter,
    );
    const weightedContribution = weightRow.weight * effectivePercentile;

    return {
      criterionId: criterion.id,
      criterionLabel: criterion.label,
      phase: criterion.phase,
      metricLabel: selectedMetric,
      playerValue: value,
      percentile,
      effectivePercentile,
      rPoints: weightRow.rPoints,
      weight: weightRow.weight,
      weightedContribution,
      higherIsBetter: weightRow.higherIsBetter,
      status: "weighted",
    };
  });
}

export function summarizeWeightedScoutingPhase(
  rows: StatsBombScoutingWeightedCriterionScore[],
  phase: StatsBombReportPhase,
): StatsBombScoutingWeightedPhaseSummary {
  const phaseRows = rows.filter((row) => row.phase === phase && row.status === "weighted");
  const totalWeight = phaseRows.reduce((sum, row) => sum + row.weight, 0);
  const weightedSum = phaseRows.reduce(
    (sum, row) => sum + (row.weightedContribution ?? 0),
    0,
  );

  return {
    phase,
    totalWeight,
    weightedAvgPercentile: totalWeight > 0 ? weightedSum / totalWeight : null,
    criterionCount: phaseRows.length,
  };
}

export function computeWeightedScoutingFitPercentile(
  rows: StatsBombScoutingWeightedCriterionScore[],
): number | null {
  const active = rows.filter((row) => row.status === "weighted" && row.weightedContribution !== null);
  if (active.length === 0) return null;

  const totalWeight = active.reduce((sum, row) => sum + row.weight, 0);
  const weightedSum = active.reduce((sum, row) => sum + (row.weightedContribution ?? 0), 0);
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

export function buildWeightedScoutingPoolRanking(
  computation: StatsBombScoutingComputation,
  weightsReport: StatsBombScoutingCorrelationWeightsReport,
): StatsBombScoutingWeightedPoolRow[] {
  const poolPlayerIds = new Set(computation.filterPool.map((player) => player.playerId));
  const rows: StatsBombScoutingWeightedPoolRow[] = [];

  for (const player of computation.players) {
    if (!poolPlayerIds.has(player.playerId)) continue;

    const scores = buildWeightedScoutingCriterionScores(
      computation,
      player.playerId,
      weightsReport,
    );
    const attackSummary = summarizeWeightedScoutingPhase(scores, "attack");
    const defenseSummary = summarizeWeightedScoutingPhase(scores, "defense");
    const weightedFit = computeWeightedScoutingFitPercentile(scores);

    rows.push({
      playerId: player.playerId,
      displayName: player.displayName,
      currentTeam: computation.teamByPlayerId.get(player.playerId) ?? "",
      minutes: player.minutes,
      age: player.age,
      height: player.height,
      preferredFoot: player.preferredFoot,
      marketValue: player.marketValue,
      overallFitPercentile: weightedFit,
      attackAvgPercentile: attackSummary.weightedAvgPercentile,
      defenseAvgPercentile: defenseSummary.weightedAvgPercentile,
      strengthCount: 0,
      weaknessCount: 0,
      matchedCriteriaCount: scores.filter((row) => row.status === "weighted").length,
      weightedFitPercentile: weightedFit,
      attackWeightedPercentile: attackSummary.weightedAvgPercentile,
      defenseWeightedPercentile: defenseSummary.weightedAvgPercentile,
    });
  }

  return rows.sort((a, b) => {
    const aFit = a.weightedFitPercentile ?? -1;
    const bFit = b.weightedFitPercentile ?? -1;
    if (bFit !== aFit) return bFit - aFit;
    return a.displayName.localeCompare(b.displayName, "pl", { sensitivity: "base" });
  });
}

export { statsBombPhaseLabel };
