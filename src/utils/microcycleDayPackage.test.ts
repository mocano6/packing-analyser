import assert from "assert";
import type {
  MicrocycleDayAssignment,
  MicrocycleDayExercise,
  MicrocycleDayPlan,
  MicrocycleProceduralTask,
  MicrocycleTrainingBlock,
  TrainingMicrocycle,
  TrainingMicrocycleState,
} from "@/types/trainingMicrocycle";
import { createDefaultTrainingMicrocycleState } from "./trainingMicrocycle";
import { resolveDayLoad } from "./microcycleLoad";
import {
  dayHasMovableContent,
  moveBlocksToDay,
  moveDaySectionContent,
  moveMicrocycleDayContent,
  reindexBlockOrdersForDays,
  swapDayPlansForMicrocycle,
  swapMicrocycleDayContent,
} from "./microcycleDayPackage";

function mc(partial?: Partial<TrainingMicrocycle>): TrainingMicrocycle {
  return {
    id: "mc1",
    seasonId: "s1",
    number: 1,
    weekStartIso: "2026-08-03",
    matches: [
      {
        dayIndex: 5,
        kickoffTime: "17:00",
        opponent: "Mazur",
        venue: "home",
        departureTime: "",
        competition: "league",
        venueAddress: "",
        surface: null,
        weatherCondition: null,
        weatherTempC: null,
      },
    ],
    daySchedules: [],
    dayLoads: [],
    ...partial,
  };
}

function baseState(overrides?: Partial<TrainingMicrocycleState>): TrainingMicrocycleState {
  const state = createDefaultTrainingMicrocycleState();
  return {
    ...state,
    microcycles: [mc()],
    activeMicrocycleId: "mc1",
    assignments: [],
    dayPlans: [],
    proceduralTasks: [],
    trainingBlocks: [],
    ...overrides,
  };
}

const block = (
  id: string,
  dayIndex: number,
  order: number
): MicrocycleTrainingBlock => ({
  id,
  microcycleId: "mc1",
  dayIndex,
  order,
  name: id,
  minutes: 10,
  formatId: null,
  pitchLength: null,
  pitchWidth: null,
  playersPerSide: null,
  tags: [],
  notes: "",
});

const assignment = (id: string, dayIndex: number): MicrocycleDayAssignment => ({
  id,
  microcycleId: "mc1",
  dayIndex,
  templateId: "t1",
  title: id,
  level: 0,
});

const task = (id: string, dayIndex: number): MicrocycleProceduralTask => ({
  id,
  microcycleId: "mc1",
  dayIndex,
  templateId: null,
  title: id,
  done: false,
});

const plan = (id: string, dayIndex: number): MicrocycleDayPlan => ({
  id,
  microcycleId: "mc1",
  dayIndex,
  templateId: null,
  generalFocus: id,
  gameMoments: "",
});

const exercise = (id: string, dayIndex: number): MicrocycleDayExercise => ({
  id,
  microcycleId: "mc1",
  dayIndex,
  templateId: null,
  name: id,
  kind: "prevention",
  minutes: 6,
  artificialTurfFocus: false,
  done: false,
  order: 0,
});

// Ten sam dzień / zły indeks → bez zmian
{
  const state = baseState({
    trainingBlocks: [block("b1", 2, 0)],
  });
  assert.strictEqual(swapMicrocycleDayContent(state, "mc1", 2, 2), state);
  assert.strictEqual(swapMicrocycleDayContent(state, "mc1", -1, 3), state);
}

// Swap: bloki, cele, zadania, godziny, obciążenie
{
  const state = baseState({
    assignments: [assignment("a1", 1), assignment("a2", 3)],
    proceduralTasks: [task("p1", 1)],
    trainingBlocks: [block("b1", 1, 0), block("b2", 1, 1), block("b3", 3, 0)],
    dayPlans: [plan("d1", 1), plan("d2", 3)],
    microcycles: [
      mc({
        daySchedules: [
          { dayIndex: 1, startTime: "10:00", endTime: "12:00" },
          { dayIndex: 3, startTime: "16:00", endTime: "18:00" },
        ],
        dayLoads: [
          { dayIndex: 1, dominant: "tension" },
          { dayIndex: 3, dominant: "velocity" },
        ],
      }),
    ],
  });

  const next = swapMicrocycleDayContent(state, "mc1", 1, 3, [5]);

  assert.equal(next.assignments.find((a) => a.id === "a1")?.dayIndex, 3);
  assert.equal(next.assignments.find((a) => a.id === "a2")?.dayIndex, 1);
  assert.equal(next.proceduralTasks?.find((t) => t.id === "p1")?.dayIndex, 3);
  assert.equal(next.trainingBlocks?.find((b) => b.id === "b1")?.dayIndex, 3);
  assert.equal(next.trainingBlocks?.find((b) => b.id === "b3")?.dayIndex, 1);
  assert.equal(next.dayPlans.find((d) => d.id === "d1")?.dayIndex, 3);
  assert.equal(next.dayPlans.find((d) => d.id === "d2")?.dayIndex, 1);

  const schedules = next.microcycles[0].daySchedules;
  assert.equal(schedules.find((s) => s.startTime === "10:00")?.dayIndex, 3);
  assert.equal(schedules.find((s) => s.startTime === "16:00")?.dayIndex, 1);
  assert.equal(next.microcycles[0].dayLoads?.find((l) => l.dominant === "tension")?.dayIndex, 3);

  // Mecze bez zmian
  assert.equal(next.microcycles[0].matches[0].dayIndex, 5);

  // Order zreindeksowany
  const day3Blocks = (next.trainingBlocks ?? [])
    .filter((b) => b.dayIndex === 3)
    .sort((a, b) => a.order - b.order);
  assert.deepEqual(
    day3Blocks.map((b) => b.order),
    [0, 1]
  );
}

// MD jako cel: nie wstawiaj tytułu na MD
{
  const plans = [plan("d1", 2)];
  const swapped = swapDayPlansForMicrocycle(plans, "mc1", 2, 5, [5]);
  assert.equal(swapped.length, 0);
}

// MD jako źródło: tytuł może wyjść na non-MD
{
  const plans = [plan("ukryty", 5), plan("wt", 1)];
  const swapped = swapDayPlansForMicrocycle(plans, "mc1", 5, 1, [5]);
  assert.equal(swapped.find((p) => p.id === "ukryty")?.dayIndex, 1);
  assert.equal(swapped.find((p) => p.id === "wt"), undefined);
}

// reindex
{
  const blocks = [block("a", 2, 5), block("b", 2, 9)];
  const reindexed = reindexBlockOrdersForDays(blocks, "mc1", [2]);
  assert.deepEqual(
    reindexed.map((b) => b.order),
    [0, 1]
  );
}

// dayHasMovableContent
{
  const empty = baseState();
  assert.equal(dayHasMovableContent(empty, "mc1", 2), false);
  const withBlock = baseState({ trainingBlocks: [block("b1", 2, 0)] });
  assert.equal(dayHasMovableContent(withBlock, "mc1", 2), true);
  assert.equal(dayHasMovableContent(withBlock, "mc1", 3), false);
}

// moveDaySectionContent — ćwiczenia siłownia/prewencja
{
  const state = baseState({
    exercises: [exercise("e1", 1), exercise("e2", 1), exercise("e3", 4)],
  });
  const next = moveDaySectionContent(state, "mc1", "cwiczenia", 1, 4);
  assert.equal(next.exercises?.filter((e) => e.dayIndex === 1).length, 0);
  assert.equal(next.exercises?.filter((e) => e.dayIndex === 4).length, 3);
}

// moveDaySectionContent — cele: źródło puste, cel dostaje assignments
{
  const state = baseState({
    assignments: [assignment("a1", 1), assignment("a2", 1), assignment("a3", 4)],
  });
  const next = moveDaySectionContent(state, "mc1", "cele", 1, 4);
  assert.equal(next.assignments.filter((a) => a.dayIndex === 1).length, 0);
  assert.equal(next.assignments.filter((a) => a.dayIndex === 4).length, 3);
}

// moveDaySectionContent — trening: bloki + schedule + rozwiązane obciążenie
{
  const state = baseState({
    assignments: [assignment("a1", 2)],
    trainingBlocks: [block("b1", 2, 0), block("b2", 2, 1), block("b3", 4, 0)],
    microcycles: [
      mc({
        daySchedules: [{ dayIndex: 2, startTime: "09:00", endTime: "11:00" }],
      }),
    ],
  });
  const fromDominant = resolveDayLoad(state.microcycles[0], 2).dominant;
  const next = moveDaySectionContent(state, "mc1", "trening", 2, 4);
  assert.equal(next.assignments.find((a) => a.id === "a1")?.dayIndex, 2); // cele zostają
  assert.equal(next.trainingBlocks?.filter((b) => b.dayIndex === 2).length, 0);
  const day4 = (next.trainingBlocks ?? [])
    .filter((b) => b.dayIndex === 4)
    .sort((a, b) => a.order - b.order);
  assert.deepEqual(
    day4.map((b) => b.id),
    ["b3", "b1", "b2"]
  );
  assert.equal(next.microcycles[0].daySchedules.find((s) => s.startTime === "09:00")?.dayIndex, 4);
  assert.equal(resolveDayLoad(next.microcycles[0], 4).dominant, fromDominant);
  assert.equal(resolveDayLoad(next.microcycles[0], 4).customized, true);
}

// Samo obciążenie
{
  const state = baseState({ microcycles: [mc()] });
  const from = resolveDayLoad(state.microcycles[0], 3);
  const next = moveDaySectionContent(state, "mc1", "obciazenie", 3, 0);
  assert.equal(resolveDayLoad(next.microcycles[0], 0).dominant, from.dominant);
  assert.equal(resolveDayLoad(next.microcycles[0], 0).targets.srpe, from.targets.srpe);
}

// trening_cele przenosi oba
{
  const state = baseState({
    assignments: [assignment("a1", 1)],
    trainingBlocks: [block("b1", 1, 0)],
  });
  const next = moveDaySectionContent(state, "mc1", "trening_cele", 1, 3);
  assert.equal(next.assignments.find((a) => a.id === "a1")?.dayIndex, 3);
  assert.equal(next.trainingBlocks?.find((b) => b.id === "b1")?.dayIndex, 3);
}

// moveMicrocycleDayContent — wszystko naraz
{
  const state = baseState({
    assignments: [assignment("a1", 1)],
    proceduralTasks: [task("t1", 1)],
    exercises: [exercise("e1", 1)],
    trainingBlocks: [block("b1", 1, 0)],
    dayPlans: [plan("d1", 1)],
  });
  const next = moveMicrocycleDayContent(state, "mc1", 1, 2, [5]);
  assert.equal(next.assignments.find((a) => a.id === "a1")?.dayIndex, 2);
  assert.equal(next.proceduralTasks?.find((t) => t.id === "t1")?.dayIndex, 2);
  assert.equal(next.exercises?.find((e) => e.id === "e1")?.dayIndex, 2);
  assert.equal(next.trainingBlocks?.find((b) => b.id === "b1")?.dayIndex, 2);
  assert.equal(next.dayPlans.find((d) => d.id === "d1")?.dayIndex, 2);
}

// Dzień wolny wędrowuje razem z całym dniem
{
  const state = baseState({
    microcycles: [mc({ restDays: [1] })],
  });
  assert.equal(dayHasMovableContent(state, "mc1", 1), true);
  const swapped = swapMicrocycleDayContent(state, "mc1", 1, 4, [5]);
  assert.deepEqual(swapped.microcycles[0].restDays, [4]);
  const moved = moveMicrocycleDayContent(state, "mc1", 1, 4, [5]);
  assert.deepEqual(moved.microcycles[0].restDays, [4]);
}

// moveBlocksToDay append
{
  const blocks = [block("a", 1, 0), block("b", 2, 0)];
  const moved = moveBlocksToDay(blocks, "mc1", 1, 2);
  assert.equal(moved.find((x) => x.id === "a")?.order, 1);
  assert.equal(moved.find((x) => x.id === "a")?.dayIndex, 2);
}

console.log("microcycleDayPackage.test.ts: ok");
