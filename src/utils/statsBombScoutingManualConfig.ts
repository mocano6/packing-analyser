import {
  buildScoutingMetricPool,
  collectSquadMetricColumns,
  resolveScoutingMetricColumn,
  type StatsBombScoutingComputation,
  type StatsBombScoutingPoolRow,
} from "./statsBombPlayerScouting";

type ScoutingMetricPool = ReturnType<typeof buildScoutingMetricPool>;
import type { StatsBombScoutingCriterion } from "./statsBombScoutingProfiles";
import type { StatsBombScoutingPositionId } from "./statsBombScoutingProfiles";
import {
  classifyStatsBombReportPhase,
  STATSBOMB_PLAYER_STRONG_PERCENTILE,
  STATSBOMB_PLAYER_WEAK_PERCENTILE,
  type StatsBombReportPhase,
} from "./statsBombTeamReport";

export const STATSBOMB_SCOUTING_MANUAL_CONFIG_STORAGE_KEY =
  "statsbomb_scouting_manual_config_v2";

export type StatsBombScoutingManualMetricEntry = {
  id: string;
  metricLabel: string | null;
  sharePercent: number;
};

export type StatsBombScoutingManualConfig = StatsBombScoutingManualMetricEntry[];

export type StatsBombScoutingManualConfigStore = Partial<
  Record<StatsBombScoutingPositionId, StatsBombScoutingManualConfig>
>;

export type StatsBombScoutingManualMetricResult = {
  entryId: string;
  metricLabel: string;
  sharePercent: number;
  phase: StatsBombReportPhase;
  playerValue: number | null;
  teamAvg: number | null;
  percentile: number | null;
};

export type StatsBombManualScoutingReport = {
  playerId: string;
  displayName: string;
  currentTeam: string;
  overallFitPercentile: number | null;
  attackAvgPercentile: number | null;
  defenseAvgPercentile: number | null;
  strengthCount: number;
  weaknessCount: number;
  matchedMetricCount: number;
  totalSharePercent: number;
  metrics: StatsBombScoutingManualMetricResult[];
};

function normalizeColumnKey(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

export function createManualMetricEntryId(): string {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function buildEmptyManualConfig(): StatsBombScoutingManualConfig {
  return [];
}

/** Wszystkie kolumny numeryczne z PlayerScout, posortowane alfabetycznie. */
export function listAllScoutingMetricOptions(availableColumns: string[]): string[] {
  return [...availableColumns].sort((a, b) => a.localeCompare(b, "pl", { sensitivity: "base" }));
}

/** Metryka pasuje do fazy kryterium (atak/obrona) lub jest na liście sugerowanych. */
export function playerMetricMatchesCriterionPhase(
  metricLabel: string,
  criterion: StatsBombScoutingCriterion,
): boolean {
  const suggested = resolveScoutingMetricColumn(criterion.metricCandidates, [metricLabel]);
  if (suggested) return true;

  const phase = classifyStatsBombReportPhase(metricLabel, "neutral");
  if (phase === criterion.phase) return true;

  return false;
}

/** Opcje metryk dla kryterium: sugerowane z profilu, potem pozostałe z CSV tej samej fazy. */
export function listMetricOptionsForScoutingCriterion(
  criterion: StatsBombScoutingCriterion,
  availableColumns: string[],
): { suggested: string[]; other: string[] } {
  const suggested: string[] = [];
  const suggestedKeys = new Set<string>();

  for (const candidate of criterion.metricCandidates) {
    const resolved = resolveScoutingMetricColumn([candidate], availableColumns);
    if (!resolved) continue;
    const key = normalizeColumnKey(resolved);
    if (suggestedKeys.has(key)) continue;
    suggestedKeys.add(key);
    suggested.push(resolved);
  }

  const other: string[] = [];
  const otherKeys = new Set<string>();

  for (const column of availableColumns) {
    const key = normalizeColumnKey(column);
    if (suggestedKeys.has(key) || otherKeys.has(key)) continue;
    if (!playerMetricMatchesCriterionPhase(column, criterion)) continue;
    otherKeys.add(key);
    other.push(column);
  }

  other.sort((a, b) => a.localeCompare(b, "pl", { sensitivity: "base" }));

  return { suggested, other };
}

function resolveStoredMetricLabel(
  requested: string | null | undefined,
  availableColumns: string[],
): string | null {
  const trimmed = requested?.trim() || null;
  if (!trimmed) return null;
  return (
    availableColumns.find((col) => normalizeColumnKey(col) === normalizeColumnKey(trimmed)) ?? null
  );
}

function sanitizeManualEntry(
  entry: unknown,
  availableColumns: string[],
): StatsBombScoutingManualMetricEntry | null {
  if (!entry || typeof entry !== "object") return null;

  const raw = entry as Partial<StatsBombScoutingManualMetricEntry>;
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : createManualMetricEntryId();
  const shareParsed = Number(raw.sharePercent);
  const sharePercent =
    Number.isFinite(shareParsed) && shareParsed >= 0 ? Math.min(100, shareParsed) : 0;

  return {
    id,
    metricLabel: resolveStoredMetricLabel(raw.metricLabel ?? null, availableColumns),
    sharePercent,
  };
}

export function sanitizeManualConfig(
  computation: StatsBombScoutingComputation,
  raw: StatsBombScoutingManualConfig | null | undefined,
): StatsBombScoutingManualConfig {
  const availableColumns = collectSquadMetricColumns(computation.players);
  if (!Array.isArray(raw)) return buildEmptyManualConfig();

  const usedMetricKeys = new Set<string>();
  const result: StatsBombScoutingManualConfig = [];

  for (const entry of raw) {
    const sanitized = sanitizeManualEntry(entry, availableColumns);
    if (!sanitized) continue;

    const metricKey = sanitized.metricLabel
      ? normalizeColumnKey(sanitized.metricLabel)
      : null;
    if (metricKey && usedMetricKeys.has(metricKey)) continue;
    if (metricKey) usedMetricKeys.add(metricKey);

    result.push(sanitized);
  }

  return result;
}

function buildMetricPoolsForManualConfig(
  computation: StatsBombScoutingComputation,
  manualConfig: StatsBombScoutingManualConfig,
): Map<string, ScoutingMetricPool> {
  const pools = new Map(computation.metricPools);

  for (const entry of manualConfig) {
    const label = entry.metricLabel?.trim();
    if (!label || pools.has(label)) continue;
    pools.set(label, buildScoutingMetricPool(label, computation.players, computation.pool));
  }

  return pools;
}

function buildManualMetricResultsForPlayer(
  computation: StatsBombScoutingComputation,
  playerId: string,
  manualConfig: StatsBombScoutingManualConfig,
  pools: Map<string, ScoutingMetricPool>,
): StatsBombScoutingManualMetricResult[] {
  const player = computation.players.find((row) => row.playerId === playerId);

  return manualConfig
    .filter((entry) => entry.metricLabel && entry.sharePercent > 0)
    .map((entry) => {
      const metricLabel = entry.metricLabel!;
      const pool = pools.get(metricLabel);
      const playerValue = player?.numeric[metricLabel];
      const value = Number.isFinite(playerValue) ? playerValue! : null;
      const percentile = pool?.percentileByPlayerId.get(playerId) ?? null;

      return {
        entryId: entry.id,
        metricLabel,
        sharePercent: entry.sharePercent,
        phase: classifyStatsBombReportPhase(metricLabel, "neutral"),
        playerValue: value,
        teamAvg: pool?.teamAvg ?? null,
        percentile,
      };
    });
}

export function computeManualConfigTotalShare(
  manualConfig: StatsBombScoutingManualConfig,
): number {
  return manualConfig.reduce(
    (sum, entry) => sum + (entry.metricLabel && entry.sharePercent > 0 ? entry.sharePercent : 0),
    0,
  );
}

export function computeManualWeightedFitFromMetrics(
  metrics: StatsBombScoutingManualMetricResult[],
): number | null {
  let totalShare = 0;
  let weightedSum = 0;

  for (const row of metrics) {
    if (row.percentile === null || row.sharePercent <= 0) continue;
    totalShare += row.sharePercent;
    weightedSum += row.sharePercent * row.percentile;
  }

  return totalShare > 0 ? weightedSum / totalShare : null;
}

function summarizeManualWeightedMetricsByPhase(
  metrics: StatsBombScoutingManualMetricResult[],
  phase: StatsBombReportPhase,
): number | null {
  let totalShare = 0;
  let weightedSum = 0;

  for (const row of metrics) {
    if (row.phase !== phase || row.percentile === null || row.sharePercent <= 0) continue;
    totalShare += row.sharePercent;
    weightedSum += row.sharePercent * row.percentile;
  }

  return totalShare > 0 ? weightedSum / totalShare : null;
}

export function buildManualWeightedScoutingReport(
  computation: StatsBombScoutingComputation,
  playerId: string,
  manualConfig: StatsBombScoutingManualConfig,
): StatsBombManualScoutingReport | null {
  const player = computation.players.find((row) => row.playerId === playerId);
  if (!player) return null;

  const pools = buildMetricPoolsForManualConfig(computation, manualConfig);
  const metrics = buildManualMetricResultsForPlayer(
    computation,
    playerId,
    manualConfig,
    pools,
  );

  const matched = metrics.filter((row) => row.percentile !== null);

  return {
    playerId,
    displayName: player.displayName,
    currentTeam: computation.teamByPlayerId.get(playerId) ?? "",
    overallFitPercentile: computeManualWeightedFitFromMetrics(metrics),
    attackAvgPercentile: summarizeManualWeightedMetricsByPhase(metrics, "attack"),
    defenseAvgPercentile: summarizeManualWeightedMetricsByPhase(metrics, "defense"),
    strengthCount: matched.filter((row) => (row.percentile ?? 0) >= STATSBOMB_PLAYER_STRONG_PERCENTILE)
      .length,
    weaknessCount: matched.filter((row) => (row.percentile ?? 0) <= STATSBOMB_PLAYER_WEAK_PERCENTILE)
      .length,
    matchedMetricCount: matched.length,
    totalSharePercent: computeManualConfigTotalShare(manualConfig),
    metrics,
  };
}

export function buildManualWeightedScoutingPoolRanking(
  computation: StatsBombScoutingComputation,
  manualConfig: StatsBombScoutingManualConfig,
): StatsBombScoutingPoolRow[] {
  const poolPlayerIds = new Set(computation.filterPool.map((player) => player.playerId));
  const rows: StatsBombScoutingPoolRow[] = [];

  for (const player of computation.players) {
    if (!poolPlayerIds.has(player.playerId)) continue;

    const report = buildManualWeightedScoutingReport(
      computation,
      player.playerId,
      manualConfig,
    );
    if (!report) continue;

    rows.push({
      playerId: player.playerId,
      displayName: player.displayName,
      currentTeam: report.currentTeam,
      minutes: player.minutes,
      age: player.age,
      height: player.height,
      preferredFoot: player.preferredFoot,
      marketValue: player.marketValue,
      overallFitPercentile: report.overallFitPercentile,
      attackAvgPercentile: report.attackAvgPercentile,
      defenseAvgPercentile: report.defenseAvgPercentile,
      strengthCount: report.strengthCount,
      weaknessCount: report.weaknessCount,
      matchedCriteriaCount: report.matchedMetricCount,
    });
  }

  return rows.sort((a, b) => {
    const aFit = a.overallFitPercentile ?? -1;
    const bFit = b.overallFitPercentile ?? -1;
    if (bFit !== aFit) return bFit - aFit;
    return a.displayName.localeCompare(b.displayName, "pl", { sensitivity: "base" });
  });
}

export function parseManualConfigStore(raw: string): StatsBombScoutingManualConfigStore {
  try {
    const parsed = JSON.parse(raw) as StatsBombScoutingManualConfigStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function loadStoredManualConfig(
  positionId: StatsBombScoutingPositionId,
): StatsBombScoutingManualConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STATSBOMB_SCOUTING_MANUAL_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const store = parseManualConfigStore(raw);
    return store[positionId] ?? null;
  } catch {
    return null;
  }
}

export function saveStoredManualConfig(
  positionId: StatsBombScoutingPositionId,
  config: StatsBombScoutingManualConfig,
): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STATSBOMB_SCOUTING_MANUAL_CONFIG_STORAGE_KEY);
    const store = raw ? parseManualConfigStore(raw) : {};
    store[positionId] = config;
    window.localStorage.setItem(STATSBOMB_SCOUTING_MANUAL_CONFIG_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage errors
  }
}

export function clearStoredManualConfig(positionId: StatsBombScoutingPositionId): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STATSBOMB_SCOUTING_MANUAL_CONFIG_STORAGE_KEY);
    if (!raw) return;
    const store = parseManualConfigStore(raw);
    delete store[positionId];
    window.localStorage.setItem(STATSBOMB_SCOUTING_MANUAL_CONFIG_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

export function manualConfigHasActiveWeights(config: StatsBombScoutingManualConfig): boolean {
  return config.some((entry) => Boolean(entry.metricLabel?.trim()) && entry.sharePercent > 0);
}
