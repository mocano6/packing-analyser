import assert from "assert";
import { regainPostMapMetricFractionDigits, regainPostMapMetricLabel } from "./wiedzaRegainMapOverlay";

assert.strictEqual(regainPostMapMetricFractionDigits("eligibleRegains"), 0);
assert.strictEqual(regainPostMapMetricFractionDigits("totalPk"), 0);
assert.strictEqual(regainPostMapMetricFractionDigits("totalPackingPoints"), 0);
assert.strictEqual(regainPostMapMetricFractionDigits("totalXg"), 3);
assert.strictEqual(regainPostMapMetricFractionDigits("totalPxt"), 3);
assert.strictEqual(regainPostMapMetricFractionDigits("totalXtDelta"), 3);

assert.strictEqual(regainPostMapMetricLabel("totalPk", 8), "PK · 8s (czyste okno)");
assert.strictEqual(regainPostMapMetricLabel("eligibleRegains", 20), "n · 20s (czyste okno)");

console.log("wiedzaRegainMapOverlay tests: OK");
