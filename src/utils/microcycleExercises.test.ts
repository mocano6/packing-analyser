import assert from "assert";
import { createDefaultTrainingMicrocycleState } from "./trainingMicrocycle";
import {
  addOrMoveExerciseFromTemplate,
  createSeedExerciseTemplates,
  exercisesForDay,
  exercisesFromDefaults,
  mergeDefaultExercisesIntoState,
  moveExerciseToDay,
  normalizeMicrocycleExercises,
  weekHasArtificialSurface,
  withoutRetiredSeedTemplates,
} from "./microcycleExercises";

const seeds = createSeedExerciseTemplates();
assert.ok(seeds.some((t) => t.kind === "gym"));
assert.ok(seeds.some((t) => t.kind === "prevention" && t.artificialTurfFocus));
assert.ok(seeds.every((t) => t.name.trim() && t.minutes > 0));
assert.ok(seeds.every((t) => !t.name.includes("Nordic")));
assert.deepEqual(
  withoutRetiredSeedTemplates([
    { id: "n", name: "Nordic Hamstring" },
    { id: "r", name: "RDL / hip hinge" },
  ]).map((t) => t.id),
  ["r"]
);
{
  const leftover = normalizeMicrocycleExercises([
    {
      id: "n1",
      microcycleId: "mc1",
      dayIndex: 2,
      name: "Nordic Hamstring",
      kind: "gym",
      minutes: 8,
    },
    {
      id: "r1",
      microcycleId: "mc1",
      dayIndex: 1,
      name: "RDL / hip hinge",
      kind: "gym",
      minutes: 10,
    },
  ]);
  assert.equal(leftover.length, 1);
  assert.equal(leftover[0].name, "RDL / hip hinge");
}

assert.equal(
  weekHasArtificialSurface([{ surface: "natural" } as never]),
  false
);
assert.equal(
  weekHasArtificialSurface([{ surface: "artificial" } as never]),
  true
);

{
  const noTurf = exercisesFromDefaults("mc1", 5, seeds, false);
  assert.ok(noTurf.every((e) => !e.artificialTurfFocus));
  assert.ok(noTurf.some((e) => e.name.includes("RDL")));
  assert.ok(noTurf.every((e) => !e.name.includes("Nordic")));
  const turf = exercisesFromDefaults("mc1", 5, seeds, true);
  assert.ok(turf.length > noTurf.length);
  assert.ok(turf.some((e) => e.artificialTurfFocus && e.name.includes("skokowego")));
}

{
  const state = createDefaultTrainingMicrocycleState(new Date("2026-08-17T12:00:00"));
  const mcId = state.microcycles[0].id;
  const withoutTurf = mergeDefaultExercisesIntoState(state, mcId, 5, seeds, false);
  const withTurf = mergeDefaultExercisesIntoState(withoutTurf, mcId, 5, seeds, true);
  assert.ok((withTurf.exercises ?? []).length > (withoutTurf.exercises ?? []).length);
  const back = mergeDefaultExercisesIntoState(withTurf, mcId, 5, seeds, false);
  assert.ok((back.exercises ?? []).every((e) => !e.artificialTurfFocus));
}

{
  const state = createDefaultTrainingMicrocycleState(new Date("2026-08-17T12:00:00"));
  const mcId = state.microcycles[0].id;
  const tpl = seeds.find((t) => t.kind === "gym")!;
  const added = addOrMoveExerciseFromTemplate(state, mcId, 1, tpl);
  assert.equal(exercisesForDay(added.exercises, mcId, 1).length, 1);
  const moved = addOrMoveExerciseFromTemplate(added, mcId, 3, tpl);
  assert.equal(exercisesForDay(moved.exercises, mcId, 1).length, 0);
  assert.equal(exercisesForDay(moved.exercises, mcId, 3).length, 1);
  const [ex] = exercisesForDay(moved.exercises, mcId, 3);
  const shifted = moveExerciseToDay(moved.exercises ?? [], ex.id, 0);
  assert.equal(exercisesForDay(shifted, mcId, 0)[0].id, ex.id);
}

{
  // MD-3 przy sobocie = środa (2). Dzień wolny nie dostaje ćwiczeń z presetu.
  const all = exercisesFromDefaults("mc1", 5, seeds, false);
  assert.ok(all.some((e) => e.dayIndex === 2));
  const rested = exercisesFromDefaults("mc1", 5, seeds, false, new Map(), [2, 4, 6]);
  assert.ok(rested.every((e) => e.dayIndex !== 2));
  assert.ok(rested.length < all.length);
}

{
  const state = createDefaultTrainingMicrocycleState(new Date("2026-08-17T12:00:00"));
  const mcId = state.microcycles[0].id;
  const placed = mergeDefaultExercisesIntoState(state, mcId, 5, seeds, false);
  assert.ok((placed.exercises ?? []).some((e) => e.dayIndex === 2));
  const skipped = mergeDefaultExercisesIntoState(placed, mcId, 5, seeds, false, [2]);
  assert.ok((skipped.exercises ?? []).every((e) => e.dayIndex !== 2));
}

console.log("microcycleExercises.test.ts: OK");
