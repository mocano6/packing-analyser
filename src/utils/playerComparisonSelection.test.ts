import assert from "node:assert/strict";
import {
  COMPARISON_POSITION_GROUP_ORDER,
  PLAYER_COMPARISON_SELECT_MAX,
  comparisonPositionGroup,
  comparisonPositionGroupLabel,
  comparisonRosterChipName,
  groupComparisonPlayersByPosition,
  sanitizeComparisonPlayerIds,
  toggleComparisonPlayerId,
  uniquePlayerComparisonLabels,
} from "./playerComparisonSelection";

assert.equal(PLAYER_COMPARISON_SELECT_MAX, 6);
assert.equal(comparisonPositionGroup("LW"), "Skrzydłowi");
assert.equal(comparisonPositionGroup("RW"), "Skrzydłowi");
assert.equal(comparisonPositionGroup("CB"), "CB");
assert.equal(comparisonPositionGroup(""), "Brak pozycji");
assert.equal(comparisonPositionGroupLabel("Skrzydłowi"), "Skrzydłowi");
assert.equal(comparisonPositionGroupLabel("CB"), "CB");
assert.equal(comparisonRosterChipName({ lastName: "Bury", playerName: "Bury Olivier" }), "Bury");
assert.equal(comparisonRosterChipName({ lastName: "  ", playerName: "Olivier Bury" }), "Olivier Bury");
assert.equal(comparisonRosterChipName({ lastName: "", playerName: "  " }), "—");
assert.ok(COMPARISON_POSITION_GROUP_ORDER.includes("RB"));

const grouped = groupComparisonPlayersByPosition([
  { firstName: "Adam", lastName: "Nowak", position: "ST" },
  { firstName: "Jan", lastName: "Kowalski", position: "CB" },
  { firstName: "Ewa", lastName: "Lis", position: "LW" },
  { firstName: "Ola", lastName: "Bąk", position: "RW" },
]);
assert.deepEqual(
  grouped.map((g) => g.group),
  ["CB", "Skrzydłowi", "ST"],
);
assert.equal(grouped[1].rows[0].position, "LW");

assert.deepEqual(toggleComparisonPlayerId(["a"], "b"), ["a", "b"]);
assert.deepEqual(toggleComparisonPlayerId(["a", "b"], "a"), ["b"]);
assert.deepEqual(toggleComparisonPlayerId(["a", "b", "c", "d", "e", "f"], "g"), [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
]);

assert.deepEqual(sanitizeComparisonPlayerIds(["gone", "b", "b"], ["a", "b", "c"]), ["b"]);
assert.deepEqual(sanitizeComparisonPlayerIds([], ["a", "b", "c", "d", "e"]), ["a", "b", "c", "d"]);
assert.deepEqual(sanitizeComparisonPlayerIds([], ["a"]), ["a"]);

const labels = uniquePlayerComparisonLabels(
  [
    { playerId: "p1", playerName: "Jan Kowalski", number: 9 },
    { playerId: "p2", playerName: "Jan Kowalski", number: 10 },
  ],
  (name) => name,
);
assert.equal(labels.get("p1"), "Jan Kowalski · 9");
assert.equal(labels.get("p2"), "Jan Kowalski · 10");

console.log("playerComparisonSelection.test.ts: OK");
