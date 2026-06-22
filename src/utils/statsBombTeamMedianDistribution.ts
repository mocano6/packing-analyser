import type { StatsBombMatchRow } from "./statsbombCsvParser";
import { getStatsBombMatchOutcome } from "./statsBombMatchOutcome";
import {
  buildTeamMedianCategorySections,
  type StatsBombDistributionObservation,
  type StatsBombMedianDistributionReport,
} from "./statsBombMedianDistribution";

const MIN_MATCHES = 3;

export function statsBombMatchRowId(row: StatsBombMatchRow): string {
  return `${row.date}__${row.opponent}`;
}

function collectMatchMetricObservations(
  rows: StatsBombMatchRow[],
): Map<string, StatsBombDistributionObservation[]> {
  const map = new Map<string, StatsBombDistributionObservation[]>();

  for (const row of rows) {
    const obsBase = {
      id: statsBombMatchRowId(row),
      label: row.opponent,
      subLabel: row.date,
      outcome: getStatsBombMatchOutcome(row),
    };

    for (const [label, value] of Object.entries(row.numeric)) {
      if (!Number.isFinite(value)) continue;
      const list = map.get(label) ?? [];
      list.push({ ...obsBase, value });
      map.set(label, list);
    }
  }

  return map;
}

export function buildStatsBombTeamMedianDistribution(
  rows: StatsBombMatchRow[],
  minMatches = MIN_MATCHES,
): StatsBombMedianDistributionReport | null {
  if (rows.length < minMatches) return null;
  const metricObservations = collectMatchMetricObservations(rows);
  const report = buildTeamMedianCategorySections(metricObservations);
  if (report.allMetrics.length === 0) return null;
  return report;
}

export { MIN_MATCHES as STATSBOMB_TEAM_MEDIAN_MIN_MATCHES };
