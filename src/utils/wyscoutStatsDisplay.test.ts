import assert from "assert";
import type { WyscoutMatchAdvancedStats } from "@/types/wyscout";
import {
  buildWyscoutMatchSides,
  buildWyscoutMetricRows,
  otherWyscoutTeamId,
  pickWyscoutTeamBlock,
  sortWyscoutCareerNewest,
  squadPlayerLabel,
} from "./wyscoutStatsDisplay";

const stats: WyscoutMatchAdvancedStats = {
  general: {
    "100": { xg: 1.09, goals: 2, shots: 12, shotsOnTarget: 5 },
    "200": { xg: 0.8, goals: 1, shots: 9, shotsOnTarget: 3 },
  },
  defence: {
    "100": { ppda: 9.8, interceptions: 29 },
    "200": { ppda: 12.1, interceptions: 18 },
  },
  passes: {
    "100": { progressivePasses: 40, passToFinalThirds: 22, deepCompletedPasses: 7, matchTempo: 16.2 },
    "200": { progressivePasses: 31, passToFinalThirds: 14, deepCompletedPasses: 4, matchTempo: 14.1 },
  },
  possession: {
    "100": { possessionPercent: 58 },
    "200": { possessionPercent: 42 },
  },
  attacks: {
    "100": { counterAttacks: 3 },
    "200": { counterAttacks: 6 },
  },
  teams: {
    "100": { wyId: 100, name: "Jagiellonia" },
    "200": { wyId: 200, name: "Lech" },
  },
};

assert.equal(pickWyscoutTeamBlock(stats.general, 100)?.xg, 1.09);
assert.equal(otherWyscoutTeamId(stats.general, 100), "200");

const sides = buildWyscoutMatchSides(stats, 100);
assert.ok(sides);
assert.equal(sides?.team.name, "Jagiellonia");
assert.equal(sides?.opponent?.name, "Lech");
assert.equal(sides?.team.xg, 1.09);

const rows = buildWyscoutMetricRows(sides!);
assert.equal(rows[0]?.team, "1.09");
assert.equal(rows.find((r) => r.key === "ppda")?.team, "9.8");

const career = sortWyscoutCareerNewest([
  { season: { startDate: "2023-07-01" }, competition: { name: "A" } },
  { season: { startDate: "2024-07-01" }, competition: { name: "B" } },
]);
assert.equal(career[0]?.competition?.name, "B");

assert.equal(squadPlayerLabel({ wyId: 1, shortName: "M. Ideguchi" }), "M. Ideguchi");
assert.equal(squadPlayerLabel({ wyId: 2, firstName: "Jan", lastName: "Kowalski" }), "Jan Kowalski");

console.log("wyscoutStatsDisplay.test.ts: OK");
