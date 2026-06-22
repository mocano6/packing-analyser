import { metricIdFromColumn } from "./statsbombCorrelation";
import {
  classifyStatsBombReportPhase,
  enrichMetricDescription,
  type StatsBombReportPhase,
} from "./statsBombTeamReport";
import { getStatsBombMetricDefinition } from "./statsbombMetricDefinitions";

/** Kategorie sekcji raportu zespołowego (jak w PDF StatsBomb). */
export type StatsBombTeamMedianCategoryId =
  | "attack_building"
  | "chance_creation"
  | "transition"
  | "pressing"
  | "goal_defense"
  | "set_pieces"
  | "general";

/** Kategorie sekcji raportu indywidualnego (jak w PDF StatsBomb). */
export type StatsBombPlayerMedianCategoryId =
  | "defensive_profile"
  | "offensive_profile"
  | "third_third"
  | "duels_fouls"
  | "general";

export type StatsBombMedianCategoryId = StatsBombTeamMedianCategoryId | StatsBombPlayerMedianCategoryId;

export type StatsBombDistributionStats = {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
  count: number;
};

export type StatsBombDistributionObservation = {
  id: string;
  label: string;
  value: number;
  /** Krótki opis kontekstu (data meczu, minuty zawodnika). */
  subLabel?: string;
  /** Wynik meczu — tylko dla obserwacji z MatchStats. */
  outcome?: "win" | "draw" | "loss";
};

export type StatsBombMetricDistributionRow = {
  id: string;
  label: string;
  description?: string;
  categoryId: StatsBombMedianCategoryId;
  phase: StatsBombReportPhase;
  stats: StatsBombDistributionStats;
  observations: StatsBombDistributionObservation[];
};

export type StatsBombMedianCategorySection = {
  id: StatsBombMedianCategoryId;
  label: string;
  metrics: StatsBombMetricDistributionRow[];
};

export type StatsBombMedianDistributionReport = {
  observationCount: number;
  categorySections: StatsBombMedianCategorySection[];
  allMetrics: StatsBombMetricDistributionRow[];
};

export const STATSBOMB_TEAM_MEDIAN_CATEGORY_LABELS: Record<StatsBombTeamMedianCategoryId, string> = {
  attack_building: "Budowanie ataków",
  chance_creation: "Tworzenie szans",
  transition: "Faza przejścia",
  pressing: "Pressing",
  goal_defense: "Obrona bramki",
  set_pieces: "Stałe fragmenty gry",
  general: "Ogólne",
};

export const STATSBOMB_PLAYER_MEDIAN_CATEGORY_LABELS: Record<StatsBombPlayerMedianCategoryId, string> = {
  defensive_profile: "Defensywa",
  offensive_profile: "Ofensywa",
  third_third: "3. tercja",
  duels_fouls: "Faule i pojedynki",
  general: "Ogólne",
};

const TEAM_CATEGORY_ORDER: StatsBombTeamMedianCategoryId[] = [
  "attack_building",
  "chance_creation",
  "transition",
  "pressing",
  "goal_defense",
  "set_pieces",
  "general",
];

const PLAYER_CATEGORY_ORDER: StatsBombPlayerMedianCategoryId[] = [
  "defensive_profile",
  "offensive_profile",
  "third_third",
  "duels_fouls",
  "general",
];

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0]!;
  const rank = (p / 100) * (sortedAsc.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sortedAsc[lower]!;
  const weight = rank - lower;
  return sortedAsc[lower]! * (1 - weight) + sortedAsc[upper]! * weight;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function computeDistributionStats(values: number[]): StatsBombDistributionStats | null {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return null;
  const sorted = [...finite].sort((a, b) => a - b);
  return {
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    q1: percentile(sorted, 25),
    median: percentile(sorted, 50),
    q3: percentile(sorted, 75),
    mean: mean(sorted),
    count: sorted.length,
  };
}

/** Metryki wyniku meczu — pomijamy w rozkładzie parametrów gry. */
const EXCLUDED_METRIC_PATTERNS =
  /^(match|date|game week|game sbd id|neutral ground|minutes|age|height|player sbd id|current team sbd id)$/i;

export function isExcludedMedianMetricLabel(label: string): boolean {
  const n = normalizeLabel(label);
  if (EXCLUDED_METRIC_PATTERNS.test(n)) return true;
  if (n === "goals & penalty goals" || n === "goals conceded") return true;
  return false;
}

export function classifyTeamMedianCategory(label: string): StatsBombTeamMedianCategoryId {
  const n = normalizeLabel(label);

  if (
    /throw.?in|corner|free kick|set piece|goal kick|penalty(?! goals conceded)|aut |rzut/i.test(n) ||
    n.includes("from corners") ||
    n.includes("from throw")
  ) {
    return "set_pieces";
  }

  if (
    /counter.?attack|counterpress|ball recover|turnover|transition|after loss|after regain|counter attacking/i.test(
      n,
    )
  ) {
    return "transition";
  }

  if (
    /ppda|pressure|counterpressure|aggressive action|defensive action distance|defensive action obv|aggression/i.test(
      n,
    ) &&
    !/conceded|faced|opposition xg|opposition shot/i.test(n)
  ) {
    return "pressing";
  }

  if (
    n.startsWith("opposition ") ||
    n.includes("conceded") ||
    n.includes("faced") ||
    n.includes("goals conceded") ||
    n.includes("dribbled past")
  ) {
    return "goal_defense";
  }

  if (
    /shot|xg|box|cross|chance|open play|clear shot|dribble|key pass|through ball|touches in box|deep completion|non penalty goal/i.test(
      n,
    ) &&
    !n.startsWith("opposition ")
  ) {
    return "chance_creation";
  }

  if (
    /pass|progression|final third|deep progression|line breaking|possession|passing|field tilt|carry|received pass|long ball/i.test(
      n,
    ) &&
    !n.startsWith("opposition ")
  ) {
    return "attack_building";
  }

  return "general";
}

export function classifyPlayerMedianCategory(label: string): StatsBombPlayerMedianCategoryId {
  const n = normalizeLabel(label);

  if (/^fouls?$|yellow card|red card|fouled|fouls won/i.test(n)) {
    return "duels_fouls";
  }

  if (
    /final third|deep progression|third|box|penalty area|into box|touches in box|line breaking|progression into/i.test(
      n,
    )
  ) {
    return "third_third";
  }

  if (
    /tackle|interception|clearance|recover|pressure|counterpressure|dribbled past|defensive|aerial|duel|challenge|block|save|goalkeeper|shots faced|goals saved|psxg|dispossessed|turnover|error/i.test(
      n,
    )
  ) {
    return "defensive_profile";
  }

  if (
    /shot|xg|cross|pass|dribble|assist|goal|carry|key pass|obv|creation|box entry|deep completion|line breaking completed|progressive|final third pass|through ball|touch|received pass/i.test(
      n,
    )
  ) {
    return "offensive_profile";
  }

  if (/foul|duel|aerial|challenge/i.test(n)) {
    return "duels_fouls";
  }

  return "general";
}

function buildMetricDistributionRow(
  label: string,
  categoryId: StatsBombMedianCategoryId,
  observations: StatsBombDistributionObservation[],
): StatsBombMetricDistributionRow | null {
  const stats = computeDistributionStats(observations.map((o) => o.value));
  if (!stats || stats.count < 2) return null;

  const nonZeroShare =
    observations.filter((o) => Math.abs(o.value) > 1e-9).length / observations.length;
  if (nonZeroShare < 0.15 && stats.max < 1e-9) return null;

  return {
    id: metricIdFromColumn(label),
    label,
    description: enrichMetricDescription(label, getStatsBombMetricDefinition(label)),
    categoryId,
    phase: classifyStatsBombReportPhase(label, "my"),
    stats,
    observations: observations.sort((a, b) => a.value - b.value),
  };
}

export function buildMedianDistributionSections(
  metricObservations: Map<string, StatsBombDistributionObservation[]>,
  categoryOrder: StatsBombMedianCategoryId[],
  categoryLabels: Record<string, string>,
  classify: (label: string) => StatsBombMedianCategoryId,
): StatsBombMedianDistributionReport {
  const allMetrics: StatsBombMetricDistributionRow[] = [];

  for (const [label, observations] of metricObservations.entries()) {
    if (isExcludedMedianMetricLabel(label)) continue;
    if (observations.length < 2) continue;
    const row = buildMetricDistributionRow(label, classify(label), observations);
    if (row) allMetrics.push(row);
  }

  allMetrics.sort((a, b) => a.label.localeCompare(b.label, "pl", { sensitivity: "base" }));

  const byCategory = new Map<StatsBombMedianCategoryId, StatsBombMetricDistributionRow[]>();
  for (const metric of allMetrics) {
    const list = byCategory.get(metric.categoryId) ?? [];
    list.push(metric);
    byCategory.set(metric.categoryId, list);
  }

  const categorySections: StatsBombMedianCategorySection[] = [];
  for (const id of categoryOrder) {
    const metrics = byCategory.get(id);
    if (!metrics?.length) continue;
    categorySections.push({
      id,
      label: categoryLabels[id] ?? id,
      metrics,
    });
  }

  const observationCount = Math.max(
    0,
    ...allMetrics.map((m) => m.stats.count),
  );

  return { observationCount, categorySections, allMetrics };
}

export function buildTeamMedianCategorySections(
  metricObservations: Map<string, StatsBombDistributionObservation[]>,
): StatsBombMedianDistributionReport {
  return buildMedianDistributionSections(
    metricObservations,
    TEAM_CATEGORY_ORDER,
    STATSBOMB_TEAM_MEDIAN_CATEGORY_LABELS,
    classifyTeamMedianCategory,
  );
}

export function buildPlayerMedianCategorySections(
  metricObservations: Map<string, StatsBombDistributionObservation[]>,
): StatsBombMedianDistributionReport {
  return buildMedianDistributionSections(
    metricObservations,
    PLAYER_CATEGORY_ORDER,
    STATSBOMB_PLAYER_MEDIAN_CATEGORY_LABELS,
    classifyPlayerMedianCategory,
  );
}

/** Pozycja obserwacji względem mediany (0–100 w skali wykresu). */
export function valueToChartPercent(
  value: number,
  stats: StatsBombDistributionStats,
  paddingRatio = 0.08,
): number {
  const span = stats.max - stats.min;
  const pad = span > 1e-9 ? span * paddingRatio : Math.max(Math.abs(stats.median) * 0.1, 0.5);
  const lo = stats.min - pad;
  const hi = stats.max + pad;
  const range = hi - lo;
  if (range <= 1e-12) return 50;
  return Math.min(100, Math.max(0, ((value - lo) / range) * 100));
}

export function formatDistributionValue(value: number, label: string): string {
  if (!Number.isFinite(value)) return "—";
  const n = normalizeLabel(label);
  if (n.includes("%")) return `${value.toFixed(1)}%`;
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}
