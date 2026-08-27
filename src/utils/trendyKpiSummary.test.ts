import assert from "node:assert/strict";
import {
  formatKpiAverageVsTargetLabel,
  formatTrendyKpiHeaderAverageLine,
  formatTrendyKpiHitMissLabel,
  summarizeKpiVsTarget,
} from "./trendyKpiSummary";

const empty = summarizeKpiVsTarget([], 1.5, "higher");
assert.equal(empty.matchCount, 0);
assert.equal(empty.average, 0);
assert.equal(empty.hitCount, 0);
assert.equal(empty.missCount, 0);
assert.equal(empty.meetsTargetOnAverage, false);

const mixedHigher = summarizeKpiVsTarget([2, 1, 3, 0.5], 1.5, "higher");
assert.equal(mixedHigher.matchCount, 4);
assert.equal(mixedHigher.average, 1.625);
assert.equal(mixedHigher.hitCount, 2);
assert.equal(mixedHigher.missCount, 2);
assert.equal(mixedHigher.meetsTargetOnAverage, true);
assert.ok(Math.abs(mixedHigher.deltaFromTarget - 0.125) < 1e-9);

const exactHit = summarizeKpiVsTarget([1.5, 1.5], 1.5, "higher");
assert.equal(exactHit.hitCount, 2);
assert.equal(exactHit.missCount, 0);
assert.equal(exactHit.meetsTargetOnAverage, true);
assert.equal(exactHit.deltaFromTarget, 0);

const lowerBetter = summarizeKpiVsTarget([4, 8, 6], 6, "lower");
assert.equal(lowerBetter.average, 6);
assert.equal(lowerBetter.hitCount, 2);
assert.equal(lowerBetter.missCount, 1);
assert.equal(lowerBetter.meetsTargetOnAverage, true);

const belowTarget = summarizeKpiVsTarget([0.8, 0.9], 1.2, "higher");
assert.equal(belowTarget.meetsTargetOnAverage, false);
assert.equal(belowTarget.hitCount, 0);
assert.equal(belowTarget.missCount, 2);

const ignoresNonFinite = summarizeKpiVsTarget([1, Number.NaN, undefined, 3, null, Infinity], 2, "higher");
assert.equal(ignoresNonFinite.matchCount, 2);
assert.equal(ignoresNonFinite.average, 2);
assert.equal(ignoresNonFinite.hitCount, 1);
assert.equal(ignoresNonFinite.missCount, 1);

assert.equal(formatKpiAverageVsTargetLabel(0.85, "number"), "0.85 powyżej celu");
assert.equal(formatKpiAverageVsTargetLabel(-0.4, "number"), "0.40 poniżej celu");
assert.equal(formatKpiAverageVsTargetLabel(0, "number"), "= celu");
assert.equal(formatKpiAverageVsTargetLabel(0.004, "number"), "= celu");
assert.equal(formatKpiAverageVsTargetLabel(2.4, "percent"), "2.4% powyżej celu");
assert.equal(formatKpiAverageVsTargetLabel(0.85, "number", "modelu"), "0.85 powyżej modelu");

assert.equal(formatTrendyKpiHitMissLabel(4, 5), "osiągnięty 4× · nie 5×");

const header = formatTrendyKpiHeaderAverageLine(mixedHigher, "number");
assert.equal(header, "śr. 1.63 · 0.13 powyżej celu");

console.log("trendyKpiSummary tests: OK");
