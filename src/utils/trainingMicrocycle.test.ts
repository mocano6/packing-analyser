import assert from "assert";
import {
  applyTrainingCountDelta,
  createDefaultTrainingMicrocycleState,
  generateMicrocycleId,
  microcyclesForSeason,
  nextMicrocycleNumber,
  renumberSeasonMicrocycles,
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

{
  const a = {
    ...defaultState.microcycles[0],
    id: generateMicrocycleId(),
    number: 1,
    weekStartIso: "2026-07-06",
  };
  const b = {
    ...defaultState.microcycles[0],
    id: generateMicrocycleId(),
    number: 3,
    weekStartIso: "2026-07-13",
  };
  const c = {
    ...defaultState.microcycles[0],
    id: generateMicrocycleId(),
    number: 5,
    weekStartIso: "2026-07-20",
  };
  const renumbered = renumberSeasonMicrocycles([a, b, c], seasonId);
  assert.equal(renumbered.find((m) => m.id === a.id)?.number, 1);
  assert.equal(renumbered.find((m) => m.id === b.id)?.number, 2);
  assert.equal(renumbered.find((m) => m.id === c.id)?.number, 3);
}

console.log("trainingMicrocycle.test.ts: OK");
