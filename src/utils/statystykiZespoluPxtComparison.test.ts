import assert from "node:assert/strict";
import { buildPxtComparisonMetrics } from "./statystykiZespoluPxtComparison";
import type { PxtTeamSideStats } from "./statystykiZespoluPxtStats";

const base: PxtTeamSideStats = {
  pxt: 4,
  xt: 1.2,
  packing: 80,
  actionCount: 10,
  passCount: 8,
  dribbleCount: 2,
  pxtPerPass: 0.5,
  pxtPerDribble: 0.2,
  pxtPerMinPossession: 0.08,
  p2Count: 3,
  p3Count: 1,
  pkCount: 1,
  shotCount: 2,
  goalCount: 1,
  dominancePct: 57,
  possessionMin: 50,
  firstHalf: {
    pxt: 2,
    xt: 0.6,
    packing: 40,
    passCount: 4,
    dribbleCount: 1,
    pxtPerPass: 0.5,
    pxtPerDribble: 0,
  },
  secondHalf: {
    pxt: 2,
    xt: 0.6,
    packing: 40,
    passCount: 4,
    dribbleCount: 1,
    pxtPerPass: 0.5,
    pxtPerDribble: 0,
  },
};

const opp: PxtTeamSideStats = { ...base, pxt: 3, dominancePct: 43, passCount: 7, actionCount: 9 };

const metrics = buildPxtComparisonMetrics(base, opp, (n) => n.toFixed(2), (n) => n.toFixed(3));
assert.ok(metrics.some((m) => m.key === "total_pxt"));
assert.equal(metrics.find((m) => m.key === "total_pxt")?.teamDisplay, "4.00");

console.log("statystykiZespoluPxtComparison.test.ts — OK");
