import type { StatsBombScoutPlayerRow, StatsBombSquadPlayerRow } from "./statsbombCsvParser";
import {
  computePlayerMetricPercentile,
  isLowerBetterPlayerMetric,
  metricAppliesToPlayer,
  STATSBOMB_PLAYER_DEFAULT_MIN_MINUTES,
  STATSBOMB_PLAYER_STRONG_PERCENTILE,
  STATSBOMB_PLAYER_WEAK_PERCENTILE,
  type StatsBombPlayerMetricRole,
} from "./statsBombPlayerReport";
import {
  getStatsBombScoutingPosition,
  type StatsBombScoutingCriterion,
  type StatsBombScoutingPositionId,
  type StatsBombScoutingPositionProfile,
} from "./statsBombScoutingProfiles";
import type { StatsBombReportPhase } from "./statsBombTeamReport";

export type StatsBombScoutingCriterionResult = {
  criterionId: string;
  criterionLabel: string;
  rationale: string;
  phase: StatsBombReportPhase;
  metricLabel: string | null;
  playerValue: number | null;
  teamAvg: number | null;
  percentile: number | null;
  role: StatsBombPlayerMetricRole;
  higherIsBetter: boolean;
  status: "matched" | "missing";
};

export type StatsBombScoutingPhaseSummary = {
  phase: StatsBombReportPhase;
  matchedCount: number;
  totalCount: number;
  avgPercentile: number | null;
  strengthCount: number;
  weaknessCount: number;
};

export type StatsBombPlayerScoutingReport = {
  position: StatsBombScoutingPositionProfile;
  playerId: string;
  displayName: string;
  currentTeam?: string;
  criteria: StatsBombScoutingCriterionResult[];
  attackSummary: StatsBombScoutingPhaseSummary;
  defenseSummary: StatsBombScoutingPhaseSummary;
  overallFitPercentile: number | null;
};

export type StatsBombScoutingPoolRow = {
  playerId: string;
  displayName: string;
  currentTeam: string;
  minutes: number;
  age: number | null;
  height: number | null;
  preferredFoot: string;
  marketValue: number | null;
  overallFitPercentile: number | null;
  attackAvgPercentile: number | null;
  defenseAvgPercentile: number | null;
  strengthCount: number;
  weaknessCount: number;
  matchedCriteriaCount: number;
};

export type StatsBombScoutingPoolFilters = {
  minMinutes: number;
  minAge?: number | null;
  maxAge?: number | null;
};

export function playerPassesScoutingPoolFilters(
  player: StatsBombScoutPlayerRow,
  filters: StatsBombScoutingPoolFilters,
): boolean {
  if (player.minutes < filters.minMinutes) return false;
  if (filters.minAge != null && Number.isFinite(filters.minAge)) {
    if (player.age === null || player.age < filters.minAge) return false;
  }
  if (filters.maxAge != null && Number.isFinite(filters.maxAge)) {
    if (player.age === null || player.age > filters.maxAge) return false;
  }
  return true;
}

type ScoutingMetricPool = {
  label: string;
  higherIsBetter: boolean;
  teamAvg: number;
  poolValues: number[];
  percentileByPlayerId: Map<string, number | null>;
};

export type StatsBombScoutingComputation = {
  position: StatsBombScoutingPositionProfile;
  players: StatsBombScoutPlayerRow[];
  /** Próba do percentyli (min. 3 zawodników — inaczej cała lista). */
  pool: StatsBombScoutPlayerRow[];
  /** Zawodnicy spełniający filtry minut/wieku — tylko oni trafiają do rankingu. */
  filterPool: StatsBombScoutPlayerRow[];
  criterionMetrics: Array<{
    criterion: StatsBombScoutingCriterion;
    metricLabel: string | null;
  }>;
  metricPools: Map<string, ScoutingMetricPool>;
  teamByPlayerId: Map<string, string>;
};

function normalizeColumnKey(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

export function collectSquadMetricColumns(players: StatsBombSquadPlayerRow[]): string[] {
  const keys = new Set<string>();
  for (const player of players) {
    for (const key of Object.keys(player.numeric)) {
      if (key === "Minutes" || key === "Age" || key === "Height") continue;
      keys.add(key);
    }
  }
  return [...keys];
}

/** Dopasowuje kolumnę Squad STATS do listy kandydatów (case-insensitive, trim). */
export function resolveScoutingMetricColumn(
  candidates: string[],
  availableColumns: string[],
): string | null {
  const normalizedAvailable = new Map(
    availableColumns.map((col) => [normalizeColumnKey(col), col]),
  );

  for (const candidate of candidates) {
    const exact = availableColumns.find((col) => col === candidate);
    if (exact) return exact;

    const normalized = normalizeColumnKey(candidate);
    const match = normalizedAvailable.get(normalized);
    if (match) return match;
  }

  return null;
}

/** Wszystkie unikalne kolumny z kandydatów profilu scoutingowego. */
export function collectScoutingProfileMetricCandidates(
  position: StatsBombScoutingPositionProfile,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const criterion of position.criteria) {
    for (const candidate of criterion.metricCandidates) {
      const key = normalizeColumnKey(candidate);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(candidate);
    }
  }
  return result;
}

function resolveHigherIsBetter(
  criterion: StatsBombScoutingCriterion,
  metricLabel: string,
): boolean {
  if (criterion.higherIsBetter !== undefined) return criterion.higherIsBetter;
  return !isLowerBetterPlayerMetric(metricLabel);
}

function metricRoleFromPercentile(percentile: number | null): StatsBombPlayerMetricRole {
  if (percentile === null) return "neutral";
  if (percentile >= STATSBOMB_PLAYER_STRONG_PERCENTILE) return "strength";
  if (percentile <= STATSBOMB_PLAYER_WEAK_PERCENTILE) return "weakness";
  return "neutral";
}

function buildPhaseSummary(
  phase: StatsBombReportPhase,
  rows: StatsBombScoutingCriterionResult[],
): StatsBombScoutingPhaseSummary {
  const phaseRows = rows.filter((row) => row.phase === phase);
  const matched = phaseRows.filter((row) => row.status === "matched" && row.percentile !== null);
  const avgPercentile =
    matched.length > 0
      ? matched.reduce((sum, row) => sum + (row.percentile ?? 0), 0) / matched.length
      : null;

  return {
    phase,
    matchedCount: phaseRows.filter((row) => row.status === "matched").length,
    totalCount: phaseRows.length,
    avgPercentile,
    strengthCount: phaseRows.filter((row) => row.role === "strength").length,
    weaknessCount: phaseRows.filter((row) => row.role === "weakness").length,
  };
}

export function buildScoutingMetricPool(
  label: string,
  players: StatsBombScoutPlayerRow[],
  pool: StatsBombScoutPlayerRow[],
): ScoutingMetricPool {
  const higherIsBetter = !isLowerBetterPlayerMetric(label);
  const poolValuesRaw = pool
    .map((p) => p.numeric[label])
    .filter((v): v is number => Number.isFinite(v));

  const poolValues: number[] = [];
  for (const player of pool) {
    const value = player.numeric[label];
    if (!Number.isFinite(value)) continue;
    if (!metricAppliesToPlayer(label, player, value, poolValuesRaw)) continue;
    poolValues.push(value);
  }

  const teamAvg =
    poolValues.length > 0
      ? poolValues.reduce((sum, value) => sum + value, 0) / poolValues.length
      : 0;

  const percentileByPlayerId = new Map<string, number | null>();
  for (const player of players) {
    const value = player.numeric[label];
    if (!Number.isFinite(value) || poolValues.length < 3) {
      percentileByPlayerId.set(player.playerId, null);
      continue;
    }
    if (!metricAppliesToPlayer(label, player, value, poolValuesRaw)) {
      percentileByPlayerId.set(player.playerId, null);
      continue;
    }
    percentileByPlayerId.set(
      player.playerId,
      computePlayerMetricPercentile(value, poolValues, higherIsBetter),
    );
  }

  return {
    label,
    higherIsBetter,
    teamAvg,
    poolValues,
    percentileByPlayerId,
  };
}

/** Jednorazowe obliczenie puli metryk scoutingowych — tylko kolumny z profilu pozycji. */
export function buildStatsBombScoutingComputation(
  players: StatsBombScoutPlayerRow[],
  positionId: StatsBombScoutingPositionId = "defensive_midfielder",
  filters: StatsBombScoutingPoolFilters = {
    minMinutes: STATSBOMB_PLAYER_DEFAULT_MIN_MINUTES,
  },
): StatsBombScoutingComputation | null {
  const position = getStatsBombScoutingPosition(positionId);
  if (!position || players.length === 0) return null;

  const filterPool = players.filter((player) => playerPassesScoutingPoolFilters(player, filters));
  const pool = filterPool.length >= 3 ? filterPool : players;
  const availableColumns = collectSquadMetricColumns(players);

  const criterionMetrics = position.criteria.map((criterion) => ({
    criterion,
    metricLabel: resolveScoutingMetricColumn(criterion.metricCandidates, availableColumns),
  }));

  const metricLabels = new Set<string>();
  for (const candidate of collectScoutingProfileMetricCandidates(position)) {
    const resolved = resolveScoutingMetricColumn([candidate], availableColumns);
    if (resolved) metricLabels.add(resolved);
  }

  const metricPools = new Map<string, ScoutingMetricPool>();
  for (const label of metricLabels) {
    metricPools.set(label, buildScoutingMetricPool(label, players, pool));
  }

  const teamByPlayerId = new Map(
    players.map((player) => [player.playerId, player.currentTeam ?? ""]),
  );

  return {
    position,
    players,
    pool,
    filterPool,
    criterionMetrics,
    metricPools,
    teamByPlayerId,
  };
}

function buildCriteriaForPlayer(
  computation: StatsBombScoutingComputation,
  playerId: string,
): StatsBombScoutingCriterionResult[] {
  return computation.criterionMetrics.map(({ criterion, metricLabel }) => {
    if (!metricLabel) {
      return {
        criterionId: criterion.id,
        criterionLabel: criterion.label,
        rationale: criterion.rationale,
        phase: criterion.phase,
        metricLabel: null,
        playerValue: null,
        teamAvg: null,
        percentile: null,
        role: "neutral",
        higherIsBetter: criterion.higherIsBetter ?? true,
        status: "missing",
      };
    }

    const pool = computation.metricPools.get(metricLabel)!;
    const playerValue = computation.players.find((p) => p.playerId === playerId)?.numeric[
      metricLabel
    ];
    const value = Number.isFinite(playerValue) ? playerValue! : null;
    const percentile = pool.percentileByPlayerId.get(playerId) ?? null;
    const higherIsBetter = resolveHigherIsBetter(criterion, metricLabel);
    const role = metricRoleFromPercentile(percentile);

    return {
      criterionId: criterion.id,
      criterionLabel: criterion.label,
      rationale: criterion.rationale,
      phase: criterion.phase,
      metricLabel,
      playerValue: value,
      teamAvg: pool.teamAvg,
      percentile,
      role,
      higherIsBetter,
      status: "matched",
    };
  });
}

export function buildStatsBombPlayerScoutingReportFromComputation(
  computation: StatsBombScoutingComputation,
  playerId: string,
): StatsBombPlayerScoutingReport | null {
  const player = computation.players.find((p) => p.playerId === playerId);
  if (!player) return null;

  const criteria = buildCriteriaForPlayer(computation, playerId);
  const attackSummary = buildPhaseSummary("attack", criteria);
  const defenseSummary = buildPhaseSummary("defense", criteria);

  const allMatched = criteria.filter((row) => row.status === "matched" && row.percentile !== null);
  const overallFitPercentile =
    allMatched.length > 0
      ? allMatched.reduce((sum, row) => sum + (row.percentile ?? 0), 0) / allMatched.length
      : null;

  return {
    position: computation.position,
    playerId,
    displayName: player.displayName,
    currentTeam: computation.teamByPlayerId.get(playerId) ?? "",
    criteria,
    attackSummary,
    defenseSummary,
    overallFitPercentile,
  };
}

export function buildStatsBombScoutingPoolRankingFromComputation(
  computation: StatsBombScoutingComputation,
): StatsBombScoutingPoolRow[] {
  const poolPlayerIds = new Set(computation.filterPool.map((player) => player.playerId));
  const rows: StatsBombScoutingPoolRow[] = [];

  for (const player of computation.players) {
    if (!poolPlayerIds.has(player.playerId)) continue;

    const report = buildStatsBombPlayerScoutingReportFromComputation(
      computation,
      player.playerId,
    );
    if (!report) continue;

    rows.push({
      playerId: player.playerId,
      displayName: player.displayName,
      currentTeam: computation.teamByPlayerId.get(player.playerId) ?? "",
      minutes: player.minutes,
      age: player.age,
      height: player.height,
      preferredFoot: player.preferredFoot,
      marketValue: player.marketValue,
      overallFitPercentile: report.overallFitPercentile,
      attackAvgPercentile: report.attackSummary.avgPercentile,
      defenseAvgPercentile: report.defenseSummary.avgPercentile,
      strengthCount:
        report.attackSummary.strengthCount + report.defenseSummary.strengthCount,
      weaknessCount:
        report.attackSummary.weaknessCount + report.defenseSummary.weaknessCount,
      matchedCriteriaCount: report.criteria.filter((row) => row.status === "matched").length,
    });
  }

  return rows.sort((a, b) => {
    const aFit = a.overallFitPercentile ?? -1;
    const bFit = b.overallFitPercentile ?? -1;
    if (bFit !== aFit) return bFit - aFit;
    return a.displayName.localeCompare(b.displayName, "pl", { sensitivity: "base" });
  });
}

export function buildStatsBombScoutingPoolRanking(
  players: StatsBombScoutPlayerRow[],
  positionId: StatsBombScoutingPositionId = "defensive_midfielder",
  filters: StatsBombScoutingPoolFilters = {
    minMinutes: STATSBOMB_PLAYER_DEFAULT_MIN_MINUTES,
  },
): StatsBombScoutingPoolRow[] {
  const computation = buildStatsBombScoutingComputation(players, positionId, filters);
  if (!computation) return [];
  return buildStatsBombScoutingPoolRankingFromComputation(computation);
}
