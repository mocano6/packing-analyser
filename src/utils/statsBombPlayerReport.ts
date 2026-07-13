import { metricIdFromColumn } from "./statsbombCorrelation";
import type { StatsBombSquadPlayerRow } from "./statsbombCsvParser";
import {
  classifyStatsBombReportPhase,
  enrichMetricDescription,
  statsBombPhaseLabel,
  type StatsBombReportPhase,
} from "./statsBombTeamReport";
import { getStatsBombMetricDefinition } from "./statsbombMetricDefinitions";

/** Percentyl w składzie powyżej którego traktujemy metrykę jako mocną stronę. */
export const STATSBOMB_PLAYER_STRONG_PERCENTILE = 75;

/** Percentyl w składzie poniżej którego traktujemy metrykę jako słabą stronę. */
export const STATSBOMB_PLAYER_WEAK_PERCENTILE = 25;

/** Domyślny próg minut — pomija zawodników z bardzo małą próbką. */
export const STATSBOMB_PLAYER_DEFAULT_MIN_MINUTES = 300;

export type StatsBombPlayerMetricRole = "strength" | "weakness" | "neutral";

export type StatsBombPlayerMetricRow = {
  id: string;
  label: string;
  description?: string;
  phase: StatsBombReportPhase;
  /** Wartość per 90 z Squad STATS. */
  playerValue: number;
  /** per90 × (minuty / 90) — szacunek sezonowy (tylko metryki wolumenowe). */
  seasonTotal: number | null;
  teamAvg: number;
  teamMedian: number;
  zScore: number | null;
  /** 0–100: im wyżej, tym lepiej w tej metryce względem składu. */
  percentile: number | null;
  role: StatsBombPlayerMetricRole;
  interpretation: string;
  higherIsBetter: boolean;
  squadLeaderName: string | null;
  squadLeaderPer90: number | null;
  isSquadLeader: boolean;
};

export type StatsBombSquadMetricStandoutRow = {
  id: string;
  label: string;
  description?: string;
  phase: StatsBombReportPhase;
  higherIsBetter: boolean;
  teamAvgPer90: number;
  leader: {
    playerId: string;
    displayName: string;
    per90: number;
    seasonTotal: number | null;
  };
  runnersUp: Array<{
    playerId: string;
    displayName: string;
    per90: number;
  }>;
};

export type StatsBombPlayerProfile = {
  player: StatsBombSquadPlayerRow;
  strengths: StatsBombPlayerMetricRow[];
  weaknesses: StatsBombPlayerMetricRow[];
  /** Wszystkie parametry z wartością zawodnika (per 90 + sezon gdy ma sens). */
  allParameters: StatsBombPlayerMetricRow[];
  ranked: StatsBombPlayerMetricRow[];
};

export type StatsBombPlayerReportSummary = {
  playerCount: number;
  eligiblePlayerCount: number;
  metricCount: number;
  minMinutes: number;
  avgMinutes: number;
};

export type StatsBombPlayerReport = {
  summary: StatsBombPlayerReportSummary;
  players: StatsBombSquadPlayerRow[];
  profiles: Record<string, StatsBombPlayerProfile>;
  /** Dla każdego parametru — kto wyróżnia się w składzie (per 90). */
  squadStandouts: StatsBombSquadMetricStandoutRow[];
};

const GK_METRIC_PATTERN =
  /goalkeeper|goals saved|psxg faced|shots faced|save%|shot stopping|goal kick|penalties faced|penalty goals conceded|non penalty save|non penalty psxg|non penalty shots faced/i;

const LOWER_IS_BETTER_PATTERN =
  /turnover|error|dribbled past|goals conceded|red card|yellow card|failed dribble|dispossessed|penalty goals conceded|non penalty goals conceded|opposition non penalty shots on target/i;

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

export function isGoalkeeperOnlyMetric(label: string): boolean {
  return GK_METRIC_PATTERN.test(label);
}

export function isLowerBetterPlayerMetric(label: string): boolean {
  return LOWER_IS_BETTER_PATTERN.test(label);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Percentyl „im lepiej” — 100 = najlepszy w składzie dla tej metryki. */
export function computePlayerMetricPercentile(
  playerValue: number,
  poolValues: number[],
  higherIsBetter: boolean,
): number | null {
  if (poolValues.length < 3) return null;
  const betterCount = poolValues.filter((v) =>
    higherIsBetter ? v < playerValue : v > playerValue,
  ).length;
  const equalCount = poolValues.filter((v) => v === playerValue).length;
  return ((betterCount + equalCount * 0.5) / poolValues.length) * 100;
}

export function metricAppliesToPlayer(
  label: string,
  player: StatsBombSquadPlayerRow,
  playerValue: number,
  poolValues: number[],
): boolean {
  const gkMetric = isGoalkeeperOnlyMetric(label);
  if (gkMetric && !player.isGoalkeeper) return false;
  if (!gkMetric && player.isGoalkeeper && /shot|xg|dribble|cross|key pass|line breaking|deep progression|touches in box/i.test(label)) {
    const nonZeroShare = poolValues.filter((v) => Math.abs(v) > 1e-9).length / poolValues.length;
    if (nonZeroShare < 0.15 && Math.abs(playerValue) < 1e-9) return false;
  }

  const nonZeroShare = poolValues.filter((v) => Math.abs(v) > 1e-9).length / poolValues.length;
  if (nonZeroShare < 0.2 && Math.abs(playerValue) < 1e-9) return false;

  return true;
}

function buildMetricInterpretation(
  label: string,
  playerValue: number,
  teamAvg: number,
  percentile: number | null,
  higherIsBetter: boolean,
): string {
  if (percentile === null) return "Za mało porównywalnych zawodników w składzie.";
  const diffPct =
    teamAvg !== 0 ? ((playerValue - teamAvg) / Math.abs(teamAvg)) * 100 : playerValue > 0 ? 100 : 0;
  const dirWord = higherIsBetter ? "więcej" : "mniej";
  const cmpWord = higherIsBetter
    ? playerValue >= teamAvg
      ? "więcej"
      : "mniej"
    : playerValue <= teamAvg
      ? "mniej"
      : "więcej";

  if (percentile >= STATSBOMB_PLAYER_STRONG_PERCENTILE) {
    return `Top ${Math.round(100 - percentile)}% składu — ${cmpWord} ${label} niż średnia (${playerValue.toFixed(2)} vs ${teamAvg.toFixed(2)}, ${dirWord} o ${Math.abs(diffPct).toFixed(0)}%).`;
  }
  if (percentile <= STATSBOMB_PLAYER_WEAK_PERCENTILE) {
    return `Dolne ${Math.round(percentile)}% składu — ${cmpWord} ${label} niż średnia (${playerValue.toFixed(2)} vs ${teamAvg.toFixed(2)}).`;
  }
  return `Blisko średniej składu (${playerValue.toFixed(2)} vs ${teamAvg.toFixed(2)}, percentyl ${Math.round(percentile)}).`;
}

function metricRoleFromPercentile(percentile: number | null): StatsBombPlayerMetricRole {
  if (percentile === null) return "neutral";
  if (percentile >= STATSBOMB_PLAYER_STRONG_PERCENTILE) return "strength";
  if (percentile <= STATSBOMB_PLAYER_WEAK_PERCENTILE) return "weakness";
  return "neutral";
}

/** Czy metryka ma sens jako szacunek sezonowy (per90 × min / 90). */
export function supportsSeasonTotalEstimate(label: string): boolean {
  const n = normalizeLabel(label);
  if (n.includes("%")) return false;
  if (/\//.test(label)) return false;
  if (/footedness|conversion|pass length|carry length|shot distance|match tempo|ppda|average/i.test(label)) {
    return false;
  }
  return true;
}

export function estimateSeasonTotalFromPer90(per90: number, minutes: number): number | null {
  if (!Number.isFinite(per90) || !Number.isFinite(minutes) || minutes <= 0) return null;
  const total = per90 * (minutes / 90);
  return Number.isFinite(total) ? total : null;
}

type SquadLeaderDraft = {
  playerId: string;
  displayName: string;
  per90: number;
};

function findSquadLeadersForMetric(
  pool: StatsBombSquadPlayerRow[],
  label: string,
  higherIsBetter: boolean,
): SquadLeaderDraft[] {
  const poolValues = pool
    .map((p) => p.numeric[label])
    .filter((v): v is number => Number.isFinite(v));

  const drafts: SquadLeaderDraft[] = [];
  for (const player of pool) {
    const per90 = player.numeric[label];
    if (!Number.isFinite(per90)) continue;
    if (!metricAppliesToPlayer(label, player, per90, poolValues)) continue;
    drafts.push({ playerId: player.playerId, displayName: player.displayName, per90 });
  }

  drafts.sort((a, b) => (higherIsBetter ? b.per90 - a.per90 : a.per90 - b.per90));
  return drafts;
}

function buildPlayerMetricRow(
  label: string,
  player: StatsBombSquadPlayerRow,
  pool: StatsBombSquadPlayerRow[],
  comparable: boolean,
): StatsBombPlayerMetricRow | null {
  const playerValue = player.numeric[label];
  if (!Number.isFinite(playerValue)) return null;

  const higherIsBetter = !isLowerBetterPlayerMetric(label);
  const poolValuesRaw = pool
    .map((p) => p.numeric[label])
    .filter((v): v is number => Number.isFinite(v));

  const comparablePool = pool.filter((p) => {
    const v = p.numeric[label];
    if (!Number.isFinite(v)) return false;
    return metricAppliesToPlayer(label, p, v, poolValuesRaw);
  });

  const poolValues = comparablePool
    .map((p) => p.numeric[label])
    .filter((v): v is number => Number.isFinite(v));

  const canCompare =
    comparable &&
    metricAppliesToPlayer(label, player, playerValue, poolValues) &&
    poolValues.length >= 3;

  const teamAvg = canCompare ? mean(poolValues) : poolValuesRaw.length > 0 ? mean(poolValuesRaw) : 0;
  const teamMedian = canCompare ? median(poolValues) : poolValuesRaw.length > 0 ? median(poolValuesRaw) : 0;
  const teamStd = canCompare ? stdDev(poolValues, teamAvg) : 0;
  const zScore =
    canCompare && teamStd > 1e-9
      ? higherIsBetter
        ? (playerValue - teamAvg) / teamStd
        : (teamAvg - playerValue) / teamStd
      : null;
  const percentile = canCompare
    ? computePlayerMetricPercentile(playerValue, poolValues, higherIsBetter)
    : null;

  const leaders = findSquadLeadersForMetric(pool, label, higherIsBetter);
  const leader = leaders[0] ?? null;

  const seasonTotal = supportsSeasonTotalEstimate(label)
    ? estimateSeasonTotalFromPer90(playerValue, player.minutes)
    : null;

  const interpretation = canCompare
    ? buildMetricInterpretation(label, playerValue, teamAvg, percentile, higherIsBetter)
    : "Brak porównania ze składem (np. metryka specyficzna dla innej roli lub za mała próba).";

  return {
    id: metricIdFromColumn(label),
    label,
    description: enrichMetricDescription(label, getStatsBombMetricDefinition(label)),
    phase: classifyStatsBombReportPhase(label, "neutral"),
    playerValue,
    seasonTotal,
    teamAvg,
    teamMedian,
    zScore,
    percentile,
    role: canCompare ? metricRoleFromPercentile(percentile) : "neutral",
    interpretation,
    higherIsBetter,
    squadLeaderName: leader?.displayName ?? null,
    squadLeaderPer90: leader?.per90 ?? null,
    isSquadLeader: leader?.playerId === player.playerId,
  };
}

export function buildSquadMetricStandouts(
  pool: StatsBombSquadPlayerRow[],
  metricColumns: string[],
): StatsBombSquadMetricStandoutRow[] {
  const rows: StatsBombSquadMetricStandoutRow[] = [];

  for (const label of metricColumns) {
    const higherIsBetter = !isLowerBetterPlayerMetric(label);
    const leaders = findSquadLeadersForMetric(pool, label, higherIsBetter);
    if (leaders.length === 0) continue;

    const poolValues = leaders.map((l) => l.per90);
    const leaderPlayer = pool.find((p) => p.playerId === leaders[0]!.playerId);
    const leaderMinutes = leaderPlayer?.minutes ?? 0;

    rows.push({
      id: metricIdFromColumn(label),
      label,
      description: enrichMetricDescription(label, getStatsBombMetricDefinition(label)),
      phase: classifyStatsBombReportPhase(label, "neutral"),
      higherIsBetter,
      teamAvgPer90: mean(poolValues),
      leader: {
        playerId: leaders[0]!.playerId,
        displayName: leaders[0]!.displayName,
        per90: leaders[0]!.per90,
        seasonTotal: supportsSeasonTotalEstimate(label)
          ? estimateSeasonTotalFromPer90(leaders[0]!.per90, leaderMinutes)
          : null,
      },
      runnersUp: leaders.slice(1, 3).map((row) => ({
        playerId: row.playerId,
        displayName: row.displayName,
        per90: row.per90,
      })),
    });
  }

  return rows.sort((a, b) => a.label.localeCompare(b.label, "pl", { sensitivity: "base" }));
}

function collectMetricColumns(players: StatsBombSquadPlayerRow[]): string[] {
  const keys = new Set<string>();
  for (const player of players) {
    for (const key of Object.keys(player.numeric)) {
      if (key === "Minutes" || key === "Age" || key === "Height") continue;
      keys.add(key);
    }
  }
  return [...keys].sort((a, b) => a.localeCompare(b, "pl", { sensitivity: "base" }));
}

export function buildStatsBombPlayerProfile(
  player: StatsBombSquadPlayerRow,
  pool: StatsBombSquadPlayerRow[],
  metricColumns: string[],
): StatsBombPlayerProfile {
  const allParameters: StatsBombPlayerMetricRow[] = [];
  const ranked: StatsBombPlayerMetricRow[] = [];

  for (const label of metricColumns) {
    const row = buildPlayerMetricRow(label, player, pool, true);
    if (!row) continue;
    allParameters.push(row);
    if (row.percentile !== null) ranked.push(row);
  }

  allParameters.sort((a, b) => a.label.localeCompare(b.label, "pl", { sensitivity: "base" }));

  ranked.sort((a, b) => {
    const aScore = a.percentile === null ? -1 : Math.abs(a.percentile - 50);
    const bScore = b.percentile === null ? -1 : Math.abs(b.percentile - 50);
    return bScore - aScore;
  });

  return {
    player,
    strengths: ranked.filter((row) => row.role === "strength"),
    weaknesses: ranked.filter((row) => row.role === "weakness"),
    allParameters,
    ranked,
  };
}

export function buildStatsBombPlayerReport(
  players: StatsBombSquadPlayerRow[],
  minMinutes = STATSBOMB_PLAYER_DEFAULT_MIN_MINUTES,
): StatsBombPlayerReport | null {
  if (players.length === 0) return null;

  const eligible = players.filter((p) => p.minutes >= minMinutes);
  const pool = eligible.length >= 3 ? eligible : players;
  const metricColumns = collectMetricColumns(pool);

  const profiles: Record<string, StatsBombPlayerProfile> = {};
  for (const player of players) {
    profiles[player.playerId] = buildStatsBombPlayerProfile(player, pool, metricColumns);
  }

  const summary: StatsBombPlayerReportSummary = {
    playerCount: players.length,
    eligiblePlayerCount: pool.length,
    metricCount: metricColumns.length,
    minMinutes,
    avgMinutes: mean(players.map((p) => p.minutes)),
  };

  const squadStandouts = buildSquadMetricStandouts(pool, metricColumns);

  return { summary, players, profiles, squadStandouts };
}

export function statsBombPlayerRoleLabel(role: StatsBombPlayerMetricRole): string {
  switch (role) {
    case "strength":
      return "Mocna strona";
    case "weakness":
      return "Słaba strona";
    default:
      return "Typowe";
  }
}

export { statsBombPhaseLabel };
