import assert from "node:assert";
import {
  getTeamInitialsForMultiSelector,
  teamsMultiSelectorSummaryLabel,
} from "./teamsMultiSelectorSummary";

const teams = [
  { id: "a", name: "Alfa" },
  { id: "b", name: "Beta" },
  { id: "c", name: "Gamma" },
];

assert.strictEqual(teamsMultiSelectorSummaryLabel([], [], false), "Brak zespołów");
assert.strictEqual(teamsMultiSelectorSummaryLabel([], teams, false), "Wybierz zespoły");

assert.strictEqual(teamsMultiSelectorSummaryLabel(["a"], [], false), "Brak zespołów");

assert.strictEqual(teamsMultiSelectorSummaryLabel(["x"], teams, false), "1 wybrano");
assert.strictEqual(teamsMultiSelectorSummaryLabel(["x"], teams, true), "1 zespołów");

assert.strictEqual(teamsMultiSelectorSummaryLabel(["a"], teams, false), "Alfa");
assert.strictEqual(teamsMultiSelectorSummaryLabel(["a", "b"], teams, false), "Alfa, Beta");
assert.strictEqual(teamsMultiSelectorSummaryLabel(["a", "b", "c"], teams, false), "Wszystkie zespoły (3)");
assert.strictEqual(teamsMultiSelectorSummaryLabel(["a", "b", "c"], teams, true), "Wszystkie (3)");
assert.strictEqual(teamsMultiSelectorSummaryLabel(["a", "c"], teams, false), "Alfa, Gamma");

const teams4 = [...teams, { id: "d", name: "Delta" }];
assert.strictEqual(
  teamsMultiSelectorSummaryLabel(["a", "b", "c"], teams4, false),
  "Alfa, Beta +1",
);

assert.strictEqual(getTeamInitialsForMultiSelector("Raków U19"), "RU");
assert.strictEqual(getTeamInitialsForMultiSelector("Single"), "SI");
assert.strictEqual(getTeamInitialsForMultiSelector(""), "?");

console.log("teamsMultiSelectorSummary.test: OK");
