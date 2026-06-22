import type { CorrelationMatrixAxisSide } from "./correlationMatrixAxis";
import { pearsonCorrelation } from "./trendyKpis";
import type { StatsBombMatchRow } from "./statsbombCsvParser";
import {
  getStatsBombMetricsFull,
  type StatsBombMetric,
} from "./statsbombCorrelation";
import { getStatsBombMetricDefinition } from "./statsbombMetricDefinitions";

export const STATSBOMB_STRONG_CORR_THRESHOLD = 0.36;

export type StatsBombReportPhase = "attack" | "defense" | "general";

export type StatsBombReportSummary = {
  matchCount: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  pointsPerMatch: number;
  goalsFor: number;
  goalsAgainst: number;
  gd: number;
  avgXg: number;
  avgXga: number;
  avgXgd: number;
};

export type StatsBombReportMetricRow = {
  id: string;
  label: string;
  description?: string;
  axisSide: CorrelationMatrixAxisSide;
  phase: StatsBombReportPhase;
  avgPerMatch: number;
  avgWhenWin: number;
  avgWhenLoss: number;
  avgWhenDraw: number;
  rPoints: number | null;
  rGd: number | null;
  absRPoints: number;
  interpretation: string;
  role: "strength" | "weakness" | "neutral";
};

export type StatsBombTeamReport = {
  summary: StatsBombReportSummary;
  xgRows: StatsBombReportMetricRow[];
  pkRows: StatsBombReportMetricRow[];
  strengths: StatsBombReportMetricRow[];
  weaknesses: StatsBombReportMetricRow[];
  ranked: StatsBombReportMetricRow[];
};

/** Metryki tożsame z celem korelacji (Pkt/GD) — nie rankujemy ich względem siebie. */
const RANKING_EXCLUDED_METRIC_IDS = new Set([
  "sb_win",
  "sb_draw",
  "sb_loss",
  "sb_points",
  "sb_gd",
  "sb_xgd",
  "sb_goals",
  "sb_goals_conceded",
]);

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

function isDirectOutcomeColumn(label: string): boolean {
  const n = normalizeLabel(label);
  if (
    n === "goals" ||
    n === "goals & penalty goals" ||
    n === "goals conceded" ||
    n === "penalty goals" ||
    n === "penalty goals conceded" ||
    n === "set piece goals" ||
    n === "goals from corners" ||
    n === "goals from throw-ins" ||
    n === "goals/corner" ||
    n === "goals/set piece" ||
    n === "goals/throw-in" ||
    n.startsWith("opposition goals") ||
    n.startsWith("opposition set piece goals")
  ) {
    return true;
  }
  return false;
}

function isXgColumn(label: string): boolean {
  const n = normalizeLabel(label);
  return (
    n.includes("xg") ||
    n.includes("x g") ||
    n === "shot obv" ||
    n === "opposition shot obv"
  );
}

function isPkBoxColumn(label: string): boolean {
  const n = normalizeLabel(label);
  return (
    n.includes("box") ||
    n.includes("inside box") ||
    n.includes("into box") ||
    n.includes("touches in box") ||
    n.includes("deep progression") ||
    n.includes("penalty") && !n.includes("conceded") && !n.includes("faced")
  );
}

export function classifyStatsBombReportPhase(
  label: string,
  axisSide: CorrelationMatrixAxisSide,
): StatsBombReportPhase {
  if (axisSide === "outcome") return "general";
  const n = normalizeLabel(label);

  if (
    axisSide === "opp" ||
    n.startsWith("opposition ") ||
    n.includes("conceded") ||
    n.includes("penalties faced") ||
    n.includes("non penalty shots faced") ||
    n.includes("goals conceded")
  ) {
    return "defense";
  }

  if (
    n.includes("tackle") ||
    n.includes("interception") ||
    n.includes("clearance") ||
    n.includes("blocked shot") ||
    n.includes("ball recover") ||
    n.includes("counterpressure") ||
    n.includes("pressure") && n.includes("defensive") ||
    n.includes("aerial") ||
    n.includes("dribbled past") ||
    n.includes("foul") && !n.includes("won")
  ) {
    return "defense";
  }

  if (
    axisSide === "my" ||
    n.includes("shot") ||
    n.includes("goal") ||
    n.includes("xg") ||
    n.includes("box") ||
    n.includes("cross") ||
    n.includes("dribble") ||
    n.includes("final third") ||
    n.includes("deep progression") ||
    n.includes("key pass") ||
    n.includes("through ball") ||
    n.includes("corner") && !n.startsWith("opposition")
  ) {
    if (n.includes("conceded") || n.startsWith("opposition ")) return "defense";
    return "attack";
  }

  return "general";
}

function avgForRows(rows: StatsBombMatchRow[], pick: (row: StatsBombMatchRow) => number): number {
  if (rows.length === 0) return 0;
  return rows.reduce((sum, row) => sum + pick(row), 0) / rows.length;
}

function fmtAvg(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "—";
}

function buildInterpretation(
  label: string,
  rPoints: number | null,
  avgWhenWin: number,
  avgWhenLoss: number,
): string {
  if (rPoints === null) return "Za mało meczów do wiarygodnej korelacji.";
  const abs = Math.abs(rPoints);
  if (abs < 0.25) {
    return `Słaby związek z wynikiem (r=${rPoints.toFixed(2)}). Średnio przy wygranej: ${fmtAvg(avgWhenWin)}, przy porażce: ${fmtAvg(avgWhenLoss)}.`;
  }
  if (rPoints > 0) {
    return `Wyższe ${label} częściej towarzyszą wygranym (r=${rPoints.toFixed(2)}). Średnio przy W: ${fmtAvg(avgWhenWin)} vs L: ${fmtAvg(avgWhenLoss)}.`;
  }
  return `Wyższe ${label} częściej towarzyszą porażkom (r=${rPoints.toFixed(2)}). Średnio przy W: ${fmtAvg(avgWhenWin)} vs L: ${fmtAvg(avgWhenLoss)}.`;
}

function metricRole(rPoints: number | null): "strength" | "weakness" | "neutral" {
  if (rPoints === null || Math.abs(rPoints) < STATSBOMB_STRONG_CORR_THRESHOLD) return "neutral";
  return rPoints > 0 ? "strength" : "weakness";
}

function buildMetricRow(
  metric: StatsBombMetric,
  rows: StatsBombMatchRow[],
  minSamples: number,
): StatsBombReportMetricRow {
  const values = rows.map((row) => metric.getValue(row));
  const points = rows.map((row) => row.outcomes.points);
  const gd = rows.map((row) => row.outcomes.gd);

  const wins = rows.filter((row) => row.outcomes.win === 1);
  const losses = rows.filter((row) => row.outcomes.loss === 1);
  const draws = rows.filter((row) => row.outcomes.draw === 1);

  const rPoints = pearsonCorrelation(values, points, minSamples, {
    omitZeroValues: false,
    zeroIsValidForX: metric.id === "sb_win" || metric.id === "sb_draw" || metric.id === "sb_loss",
    zeroIsValidForY: true,
  });
  const rGd = pearsonCorrelation(values, gd, minSamples, {
    omitZeroValues: false,
    zeroIsValidForX: metric.id === "sb_win" || metric.id === "sb_draw" || metric.id === "sb_loss",
    zeroIsValidForY: true,
  });

  // Brak meczów danej kategorii → NaN (UI pokazuje "—"), zamiast mylącego 0.00.
  const avgWhenWin = wins.length ? avgForRows(wins, (row) => metric.getValue(row)) : NaN;
  const avgWhenLoss = losses.length ? avgForRows(losses, (row) => metric.getValue(row)) : NaN;
  const avgWhenDraw = draws.length ? avgForRows(draws, (row) => metric.getValue(row)) : NaN;

  return {
    id: metric.id,
    label: metric.label,
    description: metric.description,
    axisSide: metric.axisSide,
    phase: classifyStatsBombReportPhase(metric.label, metric.axisSide),
    avgPerMatch: avgForRows(rows, (row) => metric.getValue(row)),
    avgWhenWin,
    avgWhenLoss,
    avgWhenDraw,
    rPoints,
    rGd,
    absRPoints: rPoints === null ? -1 : Math.abs(rPoints),
    interpretation: buildInterpretation(metric.label, rPoints, avgWhenWin, avgWhenLoss),
    role: metricRole(rPoints),
  };
}

export function buildStatsBombTeamReport(
  rows: StatsBombMatchRow[],
  minSamples = 3,
): StatsBombTeamReport | null {
  if (rows.length < minSamples) return null;

  const metrics = getStatsBombMetricsFull(rows);
  const allMetricRows = metrics.map((metric) => buildMetricRow(metric, rows, minSamples));

  const ranked = allMetricRows
    .filter((row) => !RANKING_EXCLUDED_METRIC_IDS.has(row.id))
    .filter((row) => !isDirectOutcomeColumn(row.label))
    .filter((row) => row.rPoints !== null)
    .sort((a, b) => b.absRPoints - a.absRPoints);

  const strengths = ranked.filter(
    (row) => row.role === "strength" && row.rPoints !== null && row.rPoints > 0,
  );
  const weaknesses = ranked.filter(
    (row) => row.role === "weakness" && row.rPoints !== null && row.rPoints < 0,
  );

  const xgRows = allMetricRows
    .filter(
      (row) =>
        row.id === "sb_xg" ||
        row.id === "sb_xga" ||
        (isXgColumn(row.label) && row.rPoints !== null),
    )
    .sort((a, b) => b.absRPoints - a.absRPoints);

  const pkRows = allMetricRows
    .filter((row) => isPkBoxColumn(row.label) && row.rPoints !== null)
    .sort((a, b) => b.absRPoints - a.absRPoints);

  const summary: StatsBombReportSummary = {
    matchCount: rows.length,
    wins: rows.filter((row) => row.outcomes.win === 1).length,
    draws: rows.filter((row) => row.outcomes.draw === 1).length,
    losses: rows.filter((row) => row.outcomes.loss === 1).length,
    points: rows.reduce((sum, row) => sum + row.outcomes.points, 0),
    pointsPerMatch: rows.reduce((sum, row) => sum + row.outcomes.points, 0) / rows.length,
    goalsFor: rows.reduce((sum, row) => sum + row.outcomes.goals, 0),
    goalsAgainst: rows.reduce((sum, row) => sum + row.outcomes.goalsConceded, 0),
    gd: rows.reduce((sum, row) => sum + row.outcomes.gd, 0),
    avgXg: avgForRows(rows, (row) => row.outcomes.xg),
    avgXga: avgForRows(rows, (row) => row.outcomes.xga),
    avgXgd: avgForRows(rows, (row) => row.outcomes.xgd),
  };

  return { summary, xgRows, pkRows, strengths, weaknesses, ranked };
}

export function statsBombPhaseLabel(phase: StatsBombReportPhase): string {
  switch (phase) {
    case "attack":
      return "Atak";
    case "defense":
      return "Obrona";
    default:
      return "Ogólne";
  }
}

export function statsBombRoleLabel(role: StatsBombReportMetricRow["role"]): string {
  switch (role) {
    case "strength":
      return "Mocna strona";
    case "weakness":
      return "Słaba strona";
    default:
      return "Neutralne";
  }
}

/** Etykieta opisowa fazy ataku/obrony dla sekcji raportu. */
export function buildStatsBombPhaseSummary(
  rows: StatsBombReportMetricRow[],
  phase: StatsBombReportPhase,
): string | null {
  const phaseRows = rows.filter((row) => row.phase === phase && row.role !== "neutral").slice(0, 3);
  if (phaseRows.length === 0) return null;
  const parts = phaseRows.map((row) => {
    const dir = row.rPoints !== null && row.rPoints > 0 ? "↑" : "↓";
    return `${row.label} (r=${row.rPoints?.toFixed(2) ?? "—"} ${dir})`;
  });
  return parts.join("; ");
}

export function enrichMetricDescription(label: string, existing?: string): string | undefined {
  return existing ?? getStatsBombMetricDefinition(label) ?? undefined;
}
