import type { StatsBombSquadPlayerRow } from "./statsbombCsvParser";
import { isGoalkeeperOnlyMetric, STATSBOMB_PLAYER_DEFAULT_MIN_MINUTES } from "./statsBombPlayerReport";
import {
  buildPlayerMedianCategorySections,
  type StatsBombDistributionObservation,
  type StatsBombMedianDistributionReport,
} from "./statsBombMedianDistribution";

const MIN_PLAYERS = 3;

function collectPlayerMetricObservations(
  players: StatsBombSquadPlayerRow[],
): Map<string, StatsBombDistributionObservation[]> {
  const map = new Map<string, StatsBombDistributionObservation[]>();

  for (const player of players) {
    const obsBase = {
      id: player.playerId,
      label: player.displayName,
      subLabel: `${Math.round(player.minutes)} min`,
    };

    for (const [label, value] of Object.entries(player.numeric)) {
      if (!Number.isFinite(value)) continue;
      if (label === "Minutes" || label === "Age" || label === "Height") continue;

      const gkMetric = isGoalkeeperOnlyMetric(label);
      if (gkMetric && !player.isGoalkeeper) continue;
      if (!gkMetric && player.isGoalkeeper && Math.abs(value) < 1e-9) continue;

      const list = map.get(label) ?? [];
      list.push({ ...obsBase, value });
      map.set(label, list);
    }
  }

  return map;
}

export function buildStatsBombPlayerMedianDistribution(
  players: StatsBombSquadPlayerRow[],
  minMinutes = STATSBOMB_PLAYER_DEFAULT_MIN_MINUTES,
  minPlayers = MIN_PLAYERS,
): StatsBombMedianDistributionReport | null {
  if (players.length < minPlayers) return null;

  const eligible = players.filter((p) => p.minutes >= minMinutes);
  const pool = eligible.length >= minPlayers ? eligible : players;
  if (pool.length < minPlayers) return null;

  const metricObservations = collectPlayerMetricObservations(pool);
  const report = buildPlayerMedianCategorySections(metricObservations);
  if (report.allMetrics.length === 0) return null;

  return report;
}

export { MIN_PLAYERS as STATSBOMB_PLAYER_MEDIAN_MIN_PLAYERS };
