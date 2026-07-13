import type { StatsBombMatchRow } from "./statsbombCsvParser";
import { statsBombMatchRowId } from "./statsBombTeamMedianDistribution";

export function filterStatsBombMatchesForMedianAnalysis(
  rows: StatsBombMatchRow[],
  excludedMatchIds: ReadonlySet<string>,
): StatsBombMatchRow[] {
  return rows.filter((row) => !excludedMatchIds.has(statsBombMatchRowId(row)));
}

export function pruneStatsBombExcludedMatchIds(
  excludedMatchIds: ReadonlySet<string>,
  validMatchIds: readonly string[],
): Set<string> {
  const valid = new Set(validMatchIds);
  return new Set([...excludedMatchIds].filter((id) => valid.has(id)));
}

export function countStatsBombIncludedMatches(
  totalCount: number,
  excludedMatchIds: ReadonlySet<string>,
): number {
  return Math.max(0, totalCount - excludedMatchIds.size);
}
