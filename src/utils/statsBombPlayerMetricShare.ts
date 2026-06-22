import type { StatsBombSquadPlayerRow } from "./statsbombCsvParser";
import { isGoalkeeperOnlyMetric } from "./statsBombPlayerReport";
import { getStatsBombMetricDefinition } from "./statsbombMetricDefinitions";

/** Minimalny udział zawodnika (%), aby pokazać w modalu. */
export const STATSBOMB_PLAYER_SHARE_MIN_PCT = 0.5;

export type StatsBombPlayerMetricShareRow = {
  playerId: string;
  displayName: string;
  minutes: number;
  per90: number;
  /** per90 × (minuty / 90) — szacowany wkład w sezonie. */
  estimatedTotal: number;
  sharePct: number;
  isGoalkeeper: boolean;
};

export type StatsBombPlayerMetricShareResult = {
  metricLabel: string;
  squadColumn: string;
  description?: string;
  teamEstimatedTotal: number;
  contributingPlayerCount: number;
  rows: StatsBombPlayerMetricShareRow[];
};

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
};

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

export function buildPlayerMetricShare(
  players: StatsBombSquadPlayerRow[],
  metricLabel: string,
  minMinutes = 1,
): StatsBombPlayerMetricShareResult | null {
  if (players.length === 0) return null;

  const squadColumn = resolveSquadMetricColumn(metricLabel, players);
  if (!squadColumn) return null;

  const drafts: StatsBombPlayerMetricShareRow[] = [];

  for (const player of players) {
    if (player.minutes < minMinutes) continue;
    const per90 = player.numeric[squadColumn];
    if (!playerAppliesToMetric(player, squadColumn, per90)) continue;
    if (!Number.isFinite(per90)) continue;

    const estimatedTotal = per90 * (player.minutes / 90);
    if (!Number.isFinite(estimatedTotal)) continue;

    const shareWeight = Math.abs(estimatedTotal);
    if (shareWeight <= 1e-12) continue;

    drafts.push({
      playerId: player.playerId,
      displayName: player.displayName,
      minutes: player.minutes,
      per90,
      estimatedTotal,
      sharePct: 0,
      isGoalkeeper: player.isGoalkeeper,
      shareWeight,
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
    description: getStatsBombMetricDefinition(squadColumn) ?? getStatsBombMetricDefinition(metricLabel),
    teamEstimatedTotal: drafts.reduce((sum, row) => sum + row.estimatedTotal, 0),
    contributingPlayerCount: rows.length,
    rows,
  };
}
