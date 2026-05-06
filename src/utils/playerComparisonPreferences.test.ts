import assert from "node:assert";
import {
  PLAYER_COMPARISON_PREFERENCES_STORAGE_KEY,
  parsePlayerComparisonPreferences,
  serializePlayerComparisonPreferences,
} from "./playerComparisonPreferences";

assert.strictEqual(PLAYER_COMPARISON_PREFERENCES_STORAGE_KEY, "playerComparison_preferences_v1");

const empty = parsePlayerComparisonPreferences(null);
assert.deepStrictEqual(empty.selectedTeamIds, []);
assert.strictEqual(empty.birthYearFrom, "");
assert.strictEqual(empty.birthYearTo, "");
assert.strictEqual(empty.mode, "per90");
assert.strictEqual(empty.comparisonMetricFamily, "pxt");
assert.strictEqual(empty.comparisonMetricRole, "sender");
assert.strictEqual(empty.minMinutes, "");
assert.strictEqual(empty.minMatches, "");
assert.deepStrictEqual(empty.selectedPositions, []);

const parsed = parsePlayerComparisonPreferences(
  JSON.stringify({
    selectedTeamIds: ["t1", "", 123, "t2"],
    birthYearFrom: "2006",
    birthYearTo: "2009",
    dateFrom: "2026-01-01",
    dateTo: "2026-05-06",
    mode: "sum",
    comparisonMetricFamily: "pkEntries",
    comparisonMetricRole: "receiver",
    minMinutes: "180",
    minMatches: "3",
    selectedPositions: ["OB", "", 1, "CM"],
  }),
);
assert.deepStrictEqual(parsed.selectedTeamIds, ["t1", "t2"]);
assert.strictEqual(parsed.birthYearFrom, "2006");
assert.strictEqual(parsed.birthYearTo, "2009");
assert.strictEqual(parsed.mode, "sum");
assert.strictEqual(parsed.comparisonMetricFamily, "pkEntries");
assert.strictEqual(parsed.comparisonMetricRole, "receiver");
assert.strictEqual(parsed.minMinutes, "180");
assert.strictEqual(parsed.minMatches, "3");
assert.deepStrictEqual(parsed.selectedPositions, ["OB", "CM"]);

const serialized = serializePlayerComparisonPreferences(parsed);
assert.ok(!serialized.includes("dateFrom"));
assert.ok(!serialized.includes("dateTo"));
assert.ok(!serialized.includes("selectedMetricId"));
assert.ok(serialized.includes('"minMinutes":"180"'));
assert.ok(serialized.includes('"minMatches":"3"'));
assert.ok(serialized.includes('"OB"'));

const legacy = parsePlayerComparisonPreferences(
  JSON.stringify({ selectedMetricId: "pkEntriesDribble", mode: "sum" }),
);
assert.strictEqual(legacy.comparisonMetricFamily, "pkEntries");
assert.strictEqual(legacy.comparisonMetricRole, "dribble");

const xgRoleIgnored = parsePlayerComparisonPreferences(
  JSON.stringify({ comparisonMetricFamily: "xg", comparisonMetricRole: "receiver" }),
);
assert.strictEqual(xgRoleIgnored.comparisonMetricFamily, "xg");
assert.strictEqual(xgRoleIgnored.comparisonMetricRole, "sender");

const invalidFamily = parsePlayerComparisonPreferences(
  JSON.stringify({ comparisonMetricFamily: "missing", comparisonMetricRole: "receiver" }),
);
assert.strictEqual(invalidFamily.comparisonMetricFamily, "pxt");
assert.strictEqual(invalidFamily.comparisonMetricRole, "sender");

console.log("playerComparisonPreferences.test: OK");
