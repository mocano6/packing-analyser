import type { StatsBombSquadPlayerRow } from "./statsbombCsvParser";
import { isGoalkeeperOnlyMetric } from "./statsBombPlayerReport";
import { getStatsBombMetricDefinition } from "./statsbombMetricDefinitions";
import {
  buildPlayerSetPieceTypeBreakdown,
  resolveSetPieceTypeBreakdownConfig,
  SET_PIECE_BREAKDOWN_MODE_NOTES,
  type SetPieceTypeBreakdownConfig,
  type SetPieceTypeBreakdownEntry,
  type SetPieceTypeBreakdownMode,
} from "./statsBombSetPieceTypeBreakdown";

/** Minimalny udział zawodnika (%), aby pokazać w modalu. */
export const STATSBOMB_PLAYER_SHARE_MIN_PCT = 0.5;

export const SET_PIECE_GOALS_METRIC_LABEL = "Set Piece Goals";
export const SET_PIECE_XG_ASSISTED_METRIC_LABEL = "Set Piece xG Assisted";

export const SET_PIECE_GOALS_UNAVAILABLE_NOTE =
  "Squad STATS nie zawiera kolumn goli ze stałych fragmentów (np. Set Piece Goals, Goals from Corners, Goals from Free Kicks, Goals from Throw-ins). Wyeksportuj Squad ze statystykami strzeleckimi SF lub przełącz się na zakładkę Set Piece xG Assisted.";

export type StatsBombPlayerMetricShareRow = {
  playerId: string;
  displayName: string;
  minutes: number;
  per90: number;
  /** per90 × (minuty / 90) — szacowany wkład w sezonie. */
  estimatedTotal: number;
  sharePct: number;
  isGoalkeeper: boolean;
  /** Szac. liczba prób (np. strzałów): samplePer90 × minuty / 90. */
  sampleTotal?: number;
  samplePer90?: number;
  /** Strzały (lub inne próby) na minutę gry: samplePer90 / 90. */
  samplePerMinute?: number;
  /** Jakość × częstotliwość: wartość metryki × Strz./min (np. xG/Shot × strzały/min). */
  volumeQualityPerMinute?: number;
  /** Rozbicie na typy stałych fragmentów (Set Piece Goals). */
  setPieceTypes?: SetPieceTypeBreakdownEntry[];
  /** Skrót dominującego typu SF (np. „Róg”). */
  dominantSetPieceType?: string;
};

export type StatsBombPlayerMetricShareMode = "share" | "rate";

export type StatsBombPlayerMetricShareResult = {
  metricLabel: string;
  squadColumn: string;
  description?: string;
  mode: StatsBombPlayerMetricShareMode;
  /** Etykieta kolumny wolumenu prób (np. strzały) w trybie rate. */
  sampleLabel?: string;
  /** Etykieta złożonego wskaźnika jakość × częstotliwość (np. xG strz./min). */
  volumeQualityLabel?: string;
  /** Gdy użyto innej kolumny Squad niż metryka MatchStats (np. brak Set Piece Goals). */
  shareNote?: string;
  /** Rozbicie typów SF w modalu (Set Piece Goals). */
  setPieceBreakdown?: {
    mode: SetPieceTypeBreakdownMode;
    modeNote: string;
  };
  teamEstimatedTotal: number;
  contributingPlayerCount: number;
  rows: StatsBombPlayerMetricShareRow[];
};

export type StatsBombSetPieceGoalsShareViews = {
  goals: StatsBombPlayerMetricShareResult | null;
  xgAssisted: StatsBombPlayerMetricShareResult | null;
};

function isSetPieceShareMetricLabel(metricLabel: string): boolean {
  const n = normalizeLabel(metricLabel);
  return n === "set piece goals" || n === "set piece xg assisted";
}

/** Metryki wyniku meczu — nie rozkładamy na zawodników. Gole strzelone mają odpowiednik w Squad STATS. */
const OUTCOME_LABELS = new Set([
  "punkty",
  "wygrana",
  "remis",
  "przegrana",
  "gd",
  "xgd",
  "gole",
  "gole stracone",
  "goals conceded",
]);

const METRIC_LABEL_ALIASES: Record<string, string[]> = {
  xg: ["Cumulative xG", "xG", "Non Penalty xG"],
  xga: ["Opposition xG", "xGA"],
  /** MatchStats „Goals” → Squad „Goals & Penalty Goals” (brak osobnej kolumny Goals w Squad). */
  goals: ["Goals & Penalty Goals", "Non Penalty Goals", "Goals"],
  "goals & penalty goals": ["Goals & Penalty Goals", "Non Penalty Goals"],
  gole: ["Goals & Penalty Goals", "Non Penalty Goals", "Goals"],
  /** MatchStats „Set Piece Goals” → Squad (bezpośrednio lub suma składników). */
  "set piece goals": ["Set Piece Goals", "Goals from Set Pieces", "SP Goals"],
};

/** Gdy brak kolumny łącznej — sumujemy gole ze składników SF (per 90). */
const METRIC_COMPOSITE_SUM_COLUMNS: Record<string, string[]> = {
  "set piece goals": [
    "Goals from Corners",
    "Goals from Free Kicks",
    "Goals from Throw-ins",
  ],
};

export type ResolvedPlayerShareMetric = {
  squadColumn: string;
  getPer90: (player: StatsBombSquadPlayerRow) => number;
  shareNote?: string;
};

/** Metryki stosunkowe z MatchStats — pokazujemy ranking zawodników (per 90), nie udział w sumie. */
const PLAYER_RATE_METRIC_ALIASES: Record<string, string[]> = {
  "xg/shot": ["Non Penalty xG/Shot", "xG/Shot", "Open Play xG/Shot"],
};

/** Kolumna wolumenu prób (Squad per 90) dla metryk stosunkowych. */
const PLAYER_RATE_VOLUME_ALIASES: Record<
  string,
  { columns: string[]; label: string; volumeQualityLabel?: string }
> = {
  "xg/shot": {
    columns: ["Non Penalty Shots", "Shots", "Open Play Shots"],
    label: "Strzały",
    volumeQualityLabel: "xG strz./min",
  },
};

function shotsPerMinuteFromPer90(per90: number | undefined): number | undefined {
  if (!Number.isFinite(per90)) return undefined;
  const rate = per90! / 90;
  return Number.isFinite(rate) ? rate : undefined;
}

/** xG/Shot × strzały/min — strzeleckie xG na minutę gry (jakość i wolumen naraz). */
export function computeVolumeQualityPerMinute(
  ratePer90: number,
  samplePer90: number | undefined,
): number | undefined {
  if (!Number.isFinite(ratePer90) || !Number.isFinite(samplePer90)) return undefined;
  const value = (ratePer90 * samplePer90!) / 90;
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

function collectSquadColumns(players: StatsBombSquadPlayerRow[]): string[] {
  const keys = new Set<string>();
  for (const player of players) {
    for (const key of Object.keys(player.numeric)) {
      if (key === "Minutes" || key === "Age" || key === "Height") continue;
      keys.add(key);
    }
  }
  return [...keys];
}

/** Metryki, dla których ma sens szacunek udziału (sumy / wolumeny, nie stosunki i %). */
export function isShareableTeamMetricLabel(label: string): boolean {
  const n = normalizeLabel(label);
  if (!n || OUTCOME_LABELS.has(n)) return false;
  if (n.includes("%")) return false;
  if (/\//.test(n)) return false;
  if (/footedness|conversion|pass length|carry length|pass length|shot distance|match tempo|ppda/i.test(n)) {
    return false;
  }
  if (/^average | average$/i.test(label.trim())) return false;
  return true;
}

export function isPlayerRateMetricLabel(label: string): boolean {
  const n = normalizeLabel(label);
  return n in PLAYER_RATE_METRIC_ALIASES;
}

/** Mapuje etykietę stosunku (np. xG/Shot) na kolumnę Squad STATS. */
export function resolvePlayerRateMetricColumn(
  metricLabel: string,
  players: StatsBombSquadPlayerRow[],
): string | null {
  if (!isPlayerRateMetricLabel(metricLabel)) return null;
  const columns = collectSquadColumns(players);
  const normalizedTarget = normalizeLabel(metricLabel);
  if (columns.includes(metricLabel)) return metricLabel;

  const caseMatch = columns.find((col) => normalizeLabel(col) === normalizedTarget);
  if (caseMatch) return caseMatch;

  const aliases = PLAYER_RATE_METRIC_ALIASES[normalizedTarget] ?? [];
  for (const alias of aliases) {
    const match = columns.find((col) => normalizeLabel(col) === normalizeLabel(alias));
    if (match) return match;
  }

  return null;
}

function resolvePlayerRateVolumeColumn(
  metricLabel: string,
  players: StatsBombSquadPlayerRow[],
): { column: string; label: string; volumeQualityLabel?: string } | null {
  const config = PLAYER_RATE_VOLUME_ALIASES[normalizeLabel(metricLabel)];
  if (!config) return null;
  const columns = collectSquadColumns(players);
  for (const alias of config.columns) {
    const match = columns.find((col) => normalizeLabel(col) === normalizeLabel(alias));
    if (match) {
      return {
        column: match,
        label: config.label,
        volumeQualityLabel: config.volumeQualityLabel,
      };
    }
  }
  return null;
}

function estimateVolumeTotal(per90: number, minutes: number): number | undefined {
  if (!Number.isFinite(per90) || !Number.isFinite(minutes) || minutes <= 0) return undefined;
  const total = per90 * (minutes / 90);
  return Number.isFinite(total) ? total : undefined;
}

/** Mapuje etykietę z MatchStats / raportu na kolumnę Squad STATS. */
export function resolveSquadMetricColumn(
  metricLabel: string,
  players: StatsBombSquadPlayerRow[],
): string | null {
  if (!isShareableTeamMetricLabel(metricLabel)) return null;
  const columns = collectSquadColumns(players);
  if (columns.includes(metricLabel)) return metricLabel;

  const normalizedTarget = normalizeLabel(metricLabel);
  const caseMatch = columns.find((col) => normalizeLabel(col) === normalizedTarget);
  if (caseMatch) return caseMatch;

  const aliases = METRIC_LABEL_ALIASES[normalizedTarget] ?? [];
  for (const alias of aliases) {
    const match = columns.find((col) => normalizeLabel(col) === normalizeLabel(alias));
    if (match) return match;
  }

  return null;
}

function sumNumericColumns(player: StatsBombSquadPlayerRow, columns: string[]): number | null {
  let sum = 0;
  let any = false;
  for (const column of columns) {
    const value = player.numeric[column];
    if (!Number.isFinite(value)) continue;
    sum += value;
    any = true;
  }
  return any ? sum : null;
}

function resolveSetPieceGoalsShare(
  players: StatsBombSquadPlayerRow[],
): ResolvedPlayerShareMetric | null {
  const directColumn = resolveSquadMetricColumn("Set Piece Goals", players);
  if (directColumn) {
    return {
      squadColumn: directColumn,
      getPer90: (player) => player.numeric[directColumn] ?? Number.NaN,
    };
  }

  const compositeColumns = METRIC_COMPOSITE_SUM_COLUMNS["set piece goals"] ?? [];
  const availableColumns = collectSquadColumns(players);
  const presentColumns = compositeColumns.filter((column) => availableColumns.includes(column));
  if (presentColumns.length > 0) {
    const squadColumn =
      presentColumns.length === 1
        ? presentColumns[0]!
        : `Set Piece Goals (${presentColumns.join(" + ")})`;
    return {
      squadColumn,
      getPer90: (player) => sumNumericColumns(player, presentColumns) ?? Number.NaN,
    };
  }

  return null;
}

export function buildSetPieceGoalsShareViews(
  players: StatsBombSquadPlayerRow[],
  minMinutes = 1,
): StatsBombSetPieceGoalsShareViews {
  return {
    goals: buildPlayerMetricShare(players, SET_PIECE_GOALS_METRIC_LABEL, minMinutes),
    xgAssisted: buildPlayerMetricShare(players, SET_PIECE_XG_ASSISTED_METRIC_LABEL, minMinutes),
  };
}

export function canOpenSetPieceGoalsShareModal(
  players: StatsBombSquadPlayerRow[],
  minMinutes = 1,
): boolean {
  const views = buildSetPieceGoalsShareViews(players, minMinutes);
  return views.goals !== null || views.xgAssisted !== null;
}

export function canOpenPlayerMetricShareModal(
  players: StatsBombSquadPlayerRow[],
  metricLabel: string,
  minMinutes = 1,
): boolean {
  if (normalizeLabel(metricLabel) === "set piece goals") {
    return canOpenSetPieceGoalsShareModal(players, minMinutes);
  }
  return canBuildPlayerMetricShare(players, metricLabel, minMinutes);
}

/** Mapuje metrykę MatchStats na sposób odczytu per 90 z Squad STATS. */
export function resolvePlayerShareMetric(
  metricLabel: string,
  players: StatsBombSquadPlayerRow[],
): ResolvedPlayerShareMetric | null {
  if (!isShareableTeamMetricLabel(metricLabel) || isPlayerRateMetricLabel(metricLabel)) {
    return null;
  }

  if (normalizeLabel(metricLabel) === "set piece goals") {
    return resolveSetPieceGoalsShare(players);
  }

  const directColumn = resolveSquadMetricColumn(metricLabel, players);
  if (directColumn) {
    return {
      squadColumn: directColumn,
      getPer90: (player) => player.numeric[directColumn] ?? Number.NaN,
    };
  }

  const compositeColumns = METRIC_COMPOSITE_SUM_COLUMNS[normalizeLabel(metricLabel)];
  if (!compositeColumns?.length) return null;

  const availableColumns = collectSquadColumns(players);
  const presentColumns = compositeColumns.filter((column) => availableColumns.includes(column));
  if (presentColumns.length === 0) return null;

  const squadColumn =
    presentColumns.length === 1
      ? presentColumns[0]!
      : `Set Piece Goals (${presentColumns.join(" + ")})`;

  return {
    squadColumn,
    getPer90: (player) => sumNumericColumns(player, presentColumns) ?? Number.NaN,
  };
}

export function canBuildPlayerMetricShare(
  players: StatsBombSquadPlayerRow[],
  metricLabel: string,
  minMinutes = 1,
): boolean {
  return buildPlayerMetricShare(players, metricLabel, minMinutes) !== null;
}

function playerAppliesToMetric(
  player: StatsBombSquadPlayerRow,
  squadColumn: string,
  per90: number,
): boolean {
  if (isGoalkeeperOnlyMetric(squadColumn) && !player.isGoalkeeper) return false;
  if (player.isGoalkeeper && /^(shots|non penalty shots|open play shots|dribbles|crosses)$/i.test(squadColumn)) {
    if (Math.abs(per90) < 1e-9) return false;
  }
  return Number.isFinite(per90);
}

function playerAppliesToRateMetric(
  player: StatsBombSquadPlayerRow,
  squadColumn: string,
  per90: number,
): boolean {
  if (!Number.isFinite(per90)) return false;
  const columnKey = squadColumn.toLowerCase();
  if (/xg\/shot/i.test(columnKey)) {
    const npShots = player.numeric["Non Penalty Shots"] ?? player.numeric.Shots;
    if (!Number.isFinite(npShots) || npShots <= 1e-9) return false;
    return per90 > 0;
  }
  if (player.isGoalkeeper && /shot obv|^shots$|non penalty shots|open play shots/i.test(columnKey)) {
    return false;
  }
  return playerAppliesToMetric(player, squadColumn, per90);
}

function buildPlayerRateMetricShare(
  players: StatsBombSquadPlayerRow[],
  metricLabel: string,
  minMinutes: number,
): StatsBombPlayerMetricShareResult | null {
  const squadColumn = resolvePlayerRateMetricColumn(metricLabel, players);
  if (!squadColumn) return null;

  const volumeMeta = resolvePlayerRateVolumeColumn(metricLabel, players);
  const drafts: StatsBombPlayerMetricShareRow[] = [];

  for (const player of players) {
    if (player.minutes < minMinutes) continue;
    const per90 = player.numeric[squadColumn];
    if (!playerAppliesToRateMetric(player, squadColumn, per90)) continue;

    const samplePer90 = volumeMeta ? player.numeric[volumeMeta.column] : undefined;
    const sampleTotal =
      volumeMeta && Number.isFinite(samplePer90)
        ? estimateVolumeTotal(samplePer90, player.minutes)
        : undefined;
    const samplePerMinute = shotsPerMinuteFromPer90(
      Number.isFinite(samplePer90) ? samplePer90 : undefined,
    );
    const volumeQualityPerMinute = computeVolumeQualityPerMinute(
      per90,
      Number.isFinite(samplePer90) ? samplePer90 : undefined,
    );

    drafts.push({
      playerId: player.playerId,
      displayName: player.displayName,
      minutes: player.minutes,
      per90,
      estimatedTotal: per90,
      sharePct: 0,
      isGoalkeeper: player.isGoalkeeper,
      samplePer90: Number.isFinite(samplePer90) ? samplePer90 : undefined,
      sampleTotal,
      samplePerMinute,
      volumeQualityPerMinute,
    });
  }

  if (drafts.length === 0) return null;

  const maxPer90 = Math.max(...drafts.map((row) => row.per90));
  const defaultSortKey = volumeMeta?.volumeQualityLabel
    ? (row: StatsBombPlayerMetricShareRow) => row.volumeQualityPerMinute ?? 0
    : (row: StatsBombPlayerMetricShareRow) => row.per90;

  const rows = drafts
    .map((row) => ({
      ...row,
      sharePct: maxPer90 > 0 ? (row.per90 / maxPer90) * 100 : 0,
    }))
    .sort((a, b) => defaultSortKey(b) - defaultSortKey(a));

  const teamAverage =
    rows.reduce((sum, row) => sum + row.per90, 0) / Math.max(rows.length, 1);

  return {
    metricLabel,
    squadColumn,
    mode: "rate",
    sampleLabel: volumeMeta?.label,
    volumeQualityLabel: volumeMeta?.volumeQualityLabel,
    description:
      getStatsBombMetricDefinition(squadColumn) ?? getStatsBombMetricDefinition(metricLabel),
    teamEstimatedTotal: teamAverage,
    contributingPlayerCount: rows.length,
    rows,
  };
}

export function buildPlayerMetricShare(
  players: StatsBombSquadPlayerRow[],
  metricLabel: string,
  minMinutes = 1,
): StatsBombPlayerMetricShareResult | null {
  if (players.length === 0) return null;

  if (isPlayerRateMetricLabel(metricLabel)) {
    return buildPlayerRateMetricShare(players, metricLabel, minMinutes);
  }

  const resolved = resolvePlayerShareMetric(metricLabel, players);
  if (!resolved) return null;
  const { squadColumn, getPer90, shareNote } = resolved;
  const setPieceBreakdownConfig: SetPieceTypeBreakdownConfig | null = isSetPieceShareMetricLabel(
    metricLabel,
  )
    ? resolveSetPieceTypeBreakdownConfig(players)
    : null;

  type DraftRow = StatsBombPlayerMetricShareRow & { shareWeight: number };
  const drafts: DraftRow[] = [];

  for (const player of players) {
    if (player.minutes < minMinutes) continue;
    const per90 = getPer90(player);
    if (!playerAppliesToMetric(player, squadColumn, per90)) continue;
    if (!Number.isFinite(per90)) continue;

    const estimatedTotal = per90 * (player.minutes / 90);
    if (!Number.isFinite(estimatedTotal)) continue;

    const shareWeight = Math.abs(estimatedTotal);
    if (shareWeight <= 1e-12) continue;

    const setPieceTypes = setPieceBreakdownConfig
      ? buildPlayerSetPieceTypeBreakdown(player, setPieceBreakdownConfig)
      : undefined;
    const dominantSetPieceType = setPieceTypes?.find((entry) => entry.isDominant)?.shortLabel;

    drafts.push({
      playerId: player.playerId,
      displayName: player.displayName,
      minutes: player.minutes,
      per90,
      estimatedTotal,
      sharePct: 0,
      isGoalkeeper: player.isGoalkeeper,
      shareWeight,
      setPieceTypes,
      dominantSetPieceType,
    });
  }

  if (drafts.length === 0) return null;

  const teamShareWeight = drafts.reduce((sum, row) => sum + row.shareWeight, 0);
  if (teamShareWeight <= 1e-12) return null;

  const rows = drafts
    .map(({ shareWeight, ...row }) => ({
      ...row,
      sharePct: (shareWeight / teamShareWeight) * 100,
    }))
    .filter((row) => row.sharePct >= STATSBOMB_PLAYER_SHARE_MIN_PCT)
    .sort((a, b) => b.sharePct - a.sharePct);

  if (rows.length === 0) return null;

  return {
    metricLabel,
    squadColumn,
    mode: "share",
    shareNote,
    setPieceBreakdown: setPieceBreakdownConfig
      ? {
          mode: setPieceBreakdownConfig.mode,
          modeNote: SET_PIECE_BREAKDOWN_MODE_NOTES[setPieceBreakdownConfig.mode],
        }
      : undefined,
    description: getStatsBombMetricDefinition(squadColumn) ?? getStatsBombMetricDefinition(metricLabel),
    teamEstimatedTotal: drafts.reduce((sum, row) => sum + row.estimatedTotal, 0),
    contributingPlayerCount: rows.length,
    rows,
  };
}
