import assert from "node:assert/strict";
import { buildXgComparisonMetrics } from "./statystykiZespoluXgComparison";
import { buildTeamSideStats } from "./statystykiZespoluXgStats";
import type { Shot, TeamInfo } from "@/types";

const match = {
  id: "m1",
  team: "home",
  opponent: "away",
  isHome: true,
  competition: "test",
  date: "2024-01-01",
} as TeamInfo;

const shot: Shot = {
  id: "s1",
  minute: 12,
  xG: 0.3,
  teamContext: "attack",
  actionType: "counter",
  shotType: "on_target",
} as Shot;

const team = buildTeamSideStats([shot], match, "home", "all", "team");
const opp = buildTeamSideStats([], match, "home", "all", "opponent");
const rows = buildXgComparisonMetrics(team, opp, (n) => n.toFixed(2), (n) => `${n > 0 ? "+" : ""}${n.toFixed(2)}`);

assert.ok(rows.some((r) => r.key === "counter"));
assert.ok(rows.some((r) => r.key === "conversion"));
assert.ok(rows.some((r) => r.key === "efficiency"));

const onTargetIdx = rows.findIndex((r) => r.key === "on_target_pct");
const gkSaveIdx = rows.findIndex((r) => r.key === "gk_save_pct");
assert.ok(onTargetIdx >= 0);
assert.ok(gkSaveIdx >= 0);
assert.equal(gkSaveIdx, onTargetIdx + 1);

console.log("statystykiZespoluXgComparison.test.ts — OK");
