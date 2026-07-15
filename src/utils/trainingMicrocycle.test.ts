import assert from "assert";
import {
  applyTrainingCountDelta,
  createDefaultTrainingMicrocycleState,
  microcyclesForSeason,
  nextMicrocycleNumber,
} from "./trainingMicrocycle";

const defaultState = createDefaultTrainingMicrocycleState(new Date("2026-07-13T12:00:00"));
assert.equal(defaultState.seasons.length, 1);
assert.equal(defaultState.microcycles.length, 1);
assert.equal(defaultState.microcycles[0].number, 1);
assert.equal(defaultState.activeSeasonId, defaultState.seasons[0].id);

const counts = applyTrainingCountDelta({}, "t1", 1);
assert.equal(counts.t1, 1);
const counts2 = applyTrainingCountDelta(counts, "t1", 2);
assert.equal(counts2.t1, 3);
const counts3 = applyTrainingCountDelta(counts2, "t1", -3);
assert.equal(counts3.t1, undefined);

const seasonId = defaultState.seasons[0].id;
assert.equal(nextMicrocycleNumber(defaultState.microcycles, seasonId), 2);
assert.equal(microcyclesForSeason(defaultState.microcycles, seasonId).length, 1);

console.log("trainingMicrocycle.test.ts: OK");
