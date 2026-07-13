import assert from "node:assert/strict";
import { buildPkComparisonMetrics } from "./statystykiZespoluPkComparison";
import type { PkTeamSideStats } from "./statystykiZespoluPkStats";

const fmt2 = (n: number) => n.toFixed(2);
const formatSigned = (n: number) => `${n > 0 ? "+" : ""}${fmt2(n)}`;

const base = (): PkTeamSideStats => ({
  entries: 10,
  goals: 2,
  shots: 5,
  regains: 1,
  regainPct: 10,
  shotPct: 50,
  goalFromShotPct: 40,
  avgPartners: 3,
  avgOpponents: 2,
  pkAdvantage: 1,
  entriesPerMatchMin: 0.11,
  entriesPerMinPossession: 0.2,
  possessionMin: 50,
  matchMinutes: 90,
  sfgCount: 1,
  dribbleCount: 4,
  passCount: 5,
  dribbleRegainCount: 1,
  passRegainCount: 0,
  controversialEntries: 0,
  firstHalf: { entries: 4, goals: 1, shots: 2 },
  secondHalf: { entries: 6, goals: 1, shots: 3 },
  entriesDominancePct: 55,
});

const team = base();
const opp = { ...base(), entries: 8, goals: 1, entriesDominancePct: 45, pkAdvantage: -0.5 };

const metrics = buildPkComparisonMetrics(team, opp, fmt2, formatSigned);
assert.ok(metrics.some((m) => m.key === "total_entries"));
assert.ok(metrics.some((m) => m.key === "pk_advantage" && m.signedValues));

console.log("statystykiZespoluPkComparison.test.ts — OK");
