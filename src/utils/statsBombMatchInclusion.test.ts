import assert from "node:assert/strict";
import type { StatsBombMatchRow } from "./statsbombCsvParser";
import {
  countStatsBombIncludedMatches,
  filterStatsBombMatchesForMedianAnalysis,
  pruneStatsBombExcludedMatchIds,
} from "./statsBombMatchInclusion";
import { statsBombMatchRowId } from "./statsBombTeamMedianDistribution";

const row = (date: string, opponent: string): StatsBombMatchRow =>
  ({
    date,
    opponent,
    matchLabel: opponent,
    isHome: true,
    numeric: { Passes: 400 },
    outcomes: {
      goals: 1,
      goalsConceded: 0,
      xg: 1,
      xga: 0.5,
      gd: 1,
      xgd: 0.5,
      points: 3,
      win: 1,
      draw: 0,
      loss: 0,
    },
  }) as StatsBombMatchRow;

const rows = [row("2024-01-01", "A"), row("2024-01-02", "B"), row("2024-01-03", "C")];
const ids = rows.map(statsBombMatchRowId);
const excluded = new Set([ids[1]!]);

assert.equal(filterStatsBombMatchesForMedianAnalysis(rows, excluded).length, 2);
assert.equal(countStatsBombIncludedMatches(rows.length, excluded), 2);
assert.deepEqual([...pruneStatsBombExcludedMatchIds(excluded, ids)], [ids[1]]);
assert.deepEqual([...pruneStatsBombExcludedMatchIds(excluded, [ids[0]!])], []);

console.log("statsBombMatchInclusion.test.ts OK");
