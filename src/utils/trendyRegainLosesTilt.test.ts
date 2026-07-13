import assert from "node:assert/strict";
import type { Action, TeamInfo } from "@/types";
import { buildTrendyRegainLosesTiltSummary, formatTrendyTiltVerdictShort } from "./trendyRegainLosesTilt";

const match = {
  id: "m1",
  team: "home",
  opponent: "away",
  isHome: true,
  competition: "test",
  date: "2024-01-01",
  actions_regain: [
    {
      id: "r1",
      teamId: "home",
      regainAttackZone: "H8",
      regainDefenseZone: "A8",
      regainAttackXT: 0.5,
      regainDefenseXT: 0.01,
      isAttack: true,
    } as Action,
    {
      id: "r2",
      teamId: "home",
      regainAttackZone: "C5",
      regainDefenseZone: "F5",
      regainAttackXT: 0.02,
      regainDefenseXT: 0.08,
      isAttack: false,
    } as Action,
  ],
  actions_loses: [
    {
      id: "l1",
      teamId: "home",
      losesAttackZone: "H7",
      losesAttackXT: 0.4,
      losesDefenseXT: 0.02,
      isAut: false,
    } as Action,
    {
      id: "l2",
      teamId: "home",
      losesAttackZone: "C4",
      losesAttackXT: 0.1,
      losesDefenseXT: 0.06,
      isAut: false,
    } as Action,
    {
      id: "l3",
      teamId: "home",
      losesAttackZone: "D5",
      isAut: true,
    } as Action,
  ],
} as TeamInfo;

const summary = buildTrendyRegainLosesTiltSummary([match]);
assert.equal(summary.regains.total, 2);
assert.equal(summary.regains.attackCount, 2);
assert.equal(summary.regains.defenseCount, 2);
assert.ok(Math.abs(summary.regains.attackXt - 0.52) < 1e-9);
assert.ok(Math.abs(summary.regains.defenseXt - 0.09) < 1e-9);

assert.equal(summary.loses.total, 2);
assert.equal(summary.loses.attackCount, 2);
assert.equal(summary.loses.defenseCount, 2);
assert.ok(Math.abs(summary.loses.attackXt - 0.5) < 1e-9);
assert.ok(Math.abs(summary.loses.defenseXt - 0.08) < 1e-9);

assert.ok(formatTrendyTiltVerdictShort(summary.regains).includes("atak"));
assert.ok(formatTrendyTiltVerdictShort(summary.loses).includes("atak"));

console.log("trendyRegainLosesTilt.test.ts: OK");
