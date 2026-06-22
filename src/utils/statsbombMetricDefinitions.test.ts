import assert from "node:assert/strict";
import {
  getStatsBombMetricDefinition,
  normalizeStatsBombMetricKey,
} from "./statsbombMetricDefinitions";

assert.equal(normalizeStatsBombMetricKey("  Cumulative xG "), "cumulative xg");

const xgDef = getStatsBombMetricDefinition("Cumulative xG");
assert.ok(xgDef && xgDef.includes("Expected Goals"));

const lbpDef = getStatsBombMetricDefinition("Line Breaking Passes Completed in Final Third");
assert.ok(lbpDef && lbpDef.toLowerCase().includes("line breaking"));

const oppDef = getStatsBombMetricDefinition("Opposition xG");
assert.ok(oppDef && oppDef.toLowerCase().includes("rywal"));

assert.equal(getStatsBombMetricDefinition("GD", "sb_gd")?.includes("Bilans"), true);

console.log("statsbombMetricDefinitions tests: OK");
