import type { TeamInfo } from "@/types";
import {
  getOpponentXGForMatch,
  getOpponentXgPerShot,
  getTeamGoalsForMatch,
  getOpponentGoalsForMatch,
  getTeamMatchPointsForMatch,
  getTeamXgForMatch,
  getTeamXgPerShotForMatch,
  pearsonCorrelation,
} from "./trendyKpis";

type QualityMetricDirection = 1 | -1;

export type TeamQualityMetricDefinition = {
  id: string;
  label: string;
  direction: QualityMetricDirection;
  getValue: (match: TeamInfo) => number;
};

export type TeamQualityMetricWeight = {
  id: string;
  label: string;
  direction: QualityMetricDirection;
  correlation: number | null;
  weight: number;
  isFallbackWeight: boolean;
};

export type TeamQualityMetricContribution = {
  id: string;
  label: string;
  value: number;
  zScore: number;
  contribution: number;
};

export type TeamQualityIndexRow = {
  teamId: string;
  teamName: string;
  matches: number;
  pointsPerMatch: number;
  qualityIndex: number;
  rawScore: number;
  metrics: TeamQualityMetricContribution[];
};

export type TeamQualityIndexModel = {
  rows: TeamQualityIndexRow[];
  weights: TeamQualityMetricWeight[];
  sampleMatches: number;
  targetLabel: "PPM";
  usedCorrelationWeights: boolean;
};

export const TEAM_QUALITY_INDEX_METRICS: TeamQualityMetricDefinition[] = [
  {
    id: "gd",
    label: "GD/mecz",
    direction: 1,
    getValue: (match) => getTeamGoalsForMatch(match) - getOpponentGoalsForMatch(match),
  },
  {
    id: "xgd",
    label: "xGD/mecz",
    direction: 1,
    getValue: (match) => getTeamXgForMatch(match) - getOpponentXGForMatch(match),
  },
  { id: "xg_for", label: "xG for", direction: 1, getValue: getTeamXgForMatch },
  { id: "xga", label: "xGA", direction: -1, getValue: getOpponentXGForMatch },
  {
    id: "xg_shot_diff",
    label: "xG/strz. diff",
    direction: 1,
    getValue: (match) => getTeamXgPerShotForMatch(match) - getOpponentXgPerShot(match),
  },
];

const average = (values: number[]): number =>
  values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const stdDev = (values: number[]): number => {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

const scaleRawScores = (rawScores: number[]): number[] => {
  const min = Math.min(...rawScores);
  const max = Math.max(...rawScores);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return rawScores.map(() => 50);
  }
  return rawScores.map((score) => 100 * ((score - min) / (max - min)));
};

export function buildTeamQualityIndexModel(
  matches: TeamInfo[],
  teamNamesById: Map<string, string>,
): TeamQualityIndexModel | null {
  if (matches.length === 0) return null;

  const weightsInput = TEAM_QUALITY_INDEX_METRICS.map((metric) => {
    const metricValues = matches.map((match) => metric.getValue(match));
    const points = matches.map(getTeamMatchPointsForMatch);
    return {
      ...metric,
      correlation: pearsonCorrelation(metricValues, points, 3, { zeroIsValidForX: true, zeroIsValidForY: true }),
    };
  });
  const validCorrelations = weightsInput.filter((metric) => metric.correlation !== null);
  const usedCorrelationWeights = validCorrelations.length >= 3;
  const weightStrengthSum = weightsInput.reduce((sum, metric) => {
    if (!usedCorrelationWeights) return sum + 1;
    return sum + (metric.correlation === null ? 0 : Math.abs(metric.correlation));
  }, 0);

  const weights: TeamQualityMetricWeight[] = weightsInput.map((metric) => {
    const strength = usedCorrelationWeights && metric.correlation !== null ? Math.abs(metric.correlation) : 1;
    return {
      id: metric.id,
      label: metric.label,
      direction: metric.direction,
      correlation: metric.correlation,
      weight: weightStrengthSum > 0 ? strength / weightStrengthSum : 0,
      isFallbackWeight: !usedCorrelationWeights || metric.correlation === null,
    };
  });

  const matchesByTeam = new Map<string, TeamInfo[]>();
  matches.forEach((match) => {
    const teamId = match.team;
    matchesByTeam.set(teamId, [...(matchesByTeam.get(teamId) ?? []), match]);
  });

  const teamMetricValues = [...matchesByTeam.entries()].map(([teamId, teamMatches]) => ({
    teamId,
    teamName: teamNamesById.get(teamId) ?? teamId,
    matches: teamMatches.length,
    pointsPerMatch: average(teamMatches.map(getTeamMatchPointsForMatch)),
    metricValues: Object.fromEntries(
      TEAM_QUALITY_INDEX_METRICS.map((metric) => [
        metric.id,
        average(teamMatches.map((match) => metric.getValue(match))),
      ]),
    ) as Record<string, number>,
  }));

  const metricStats = new Map(
    TEAM_QUALITY_INDEX_METRICS.map((metric) => {
      const values = teamMetricValues.map((row) => row.metricValues[metric.id]);
      return [metric.id, { mean: average(values), sd: stdDev(values) }];
    }),
  );

  const rowsWithRaw = teamMetricValues.map((teamRow) => {
    const metrics = weights.map((weight) => {
      const value = teamRow.metricValues[weight.id] ?? 0;
      const stats = metricStats.get(weight.id);
      const zScore = stats && stats.sd > 0 ? (value - stats.mean) / stats.sd : 0;
      const contribution = weight.direction * weight.weight * zScore;
      return {
        id: weight.id,
        label: weight.label,
        value,
        zScore,
        contribution,
      };
    });
    return {
      ...teamRow,
      rawScore: metrics.reduce((sum, metric) => sum + metric.contribution, 0),
      metrics,
    };
  });

  const scaledScores = scaleRawScores(rowsWithRaw.map((row) => row.rawScore));
  const rows = rowsWithRaw
    .map((row, index) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      matches: row.matches,
      pointsPerMatch: row.pointsPerMatch,
      rawScore: row.rawScore,
      qualityIndex: scaledScores[index],
      metrics: row.metrics.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)),
    }))
    .sort((a, b) => b.qualityIndex - a.qualityIndex);

  return {
    rows,
    weights,
    sampleMatches: matches.length,
    targetLabel: "PPM",
    usedCorrelationWeights,
  };
}
