import assert from "node:assert/strict";
import {
  POSITIONS,
  POSITION_VALUES,
  getDefaultPosition,
  mapOldPositionToNew,
} from "./positions";

assert.deepEqual(POSITION_VALUES, [
  "GK",
  "CB",
  "RB",
  "LB",
  "DM",
  "CM",
  "AM",
  "LW",
  "RW",
  "ST",
]);
assert.equal(POSITIONS.length, 10);
assert.equal(POSITIONS.find((p) => p.value === "RB")?.label, "Prawy obrońca (RB)");
assert.equal(POSITIONS.find((p) => p.value === "CM")?.label, "Środkowy pomocnik (CM)");

assert.equal(mapOldPositionToNew("LS"), "LW");
assert.equal(mapOldPositionToNew("RB"), "RB");
assert.equal(getDefaultPosition("RB"), "RB");
assert.equal(getDefaultPosition("LB"), "LB");
assert.equal(getDefaultPosition("CM"), "CM");
assert.equal(getDefaultPosition("CDM"), "DM");
assert.equal(getDefaultPosition("XX"), "CB");
assert.equal(getDefaultPosition(undefined), "CB");

console.log("positions.test.ts: OK");
