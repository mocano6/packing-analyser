import assert from "assert";
import type {
  TrainingMicrocycleState,
  TrainingProceduralTaskTemplate,
} from "@/types/trainingMicrocycle";
import { createDefaultTrainingMicrocycleState } from "@/utils/trainingMicrocycle";
import {
  createSeedProceduralTaskTemplates,
  mergeDefaultProceduralTasksIntoState,
  normalizeProceduralTasks,
  proceduralTasksForDay,
  proceduralTasksFromDefaults,
  setProceduralTemplateDefaultCoachId,
  setProceduralTemplateDefaultMatchDayOffset,
  applyCoachIdToProceduralTasks,
  clearCoachFromProceduralTemplates,
  clearCoachFromProceduralTasks,
  sanitizeOptionalCoachId,
} from "./proceduralTaskDefaults";

const seed = createSeedProceduralTaskTemplates();
assert.ok(seed.length >= 4);
assert.ok(seed.some((t) => t.defaultMatchDayOffset === -5));
assert.equal(seed.filter((t) => t.defaultMatchDayOffset === -1).length, 2);

// MD w sobotę (5): MD-5 = poniedziałek (0), MD-1 = piątek (4)
const tasks = proceduralTasksFromDefaults("mc1", 5, seed);
assert.ok(tasks.some((t) => t.dayIndex === 0 && t.title.includes("protokołów")));
assert.equal(tasks.filter((t) => t.dayIndex === 4).length, 2);

// Wiele zadań na tym samym MD
const templates: TrainingProceduralTaskTemplate[] = [
  { id: "a", title: "A", defaultMatchDayOffset: -1 },
  { id: "b", title: "B", defaultMatchDayOffset: -1 },
  { id: "c", title: "C", defaultMatchDayOffset: -2 },
];
const multi = proceduralTasksFromDefaults("mc1", 5, templates);
assert.equal(multi.filter((t) => t.dayIndex === 4).length, 2);
assert.equal(multi.filter((t) => t.dayIndex === 3).length, 1);

// Zachowanie done przy re-merge
const base = createDefaultTrainingMicrocycleState(new Date("2026-08-03T12:00:00"));
const mcId = base.microcycles[0].id;
let state: TrainingMicrocycleState = mergeDefaultProceduralTasksIntoState(
  base,
  mcId,
  5,
  templates
);
const taskA = (state.proceduralTasks ?? []).find((t) => t.templateId === "a");
assert.ok(taskA);
state = {
  ...state,
  proceduralTasks: (state.proceduralTasks ?? []).map((t) =>
    t.templateId === "a" ? { ...t, done: true } : t
  ),
};
state = mergeDefaultProceduralTasksIntoState(state, mcId, 5, templates);
const after = (state.proceduralTasks ?? []).find((t) => t.templateId === "a");
assert.equal(after?.done, true);
assert.equal((state.proceduralTasks ?? []).filter((t) => t.microcycleId === mcId).length, 3);

// Zmiana dnia meczu przesuwa zadania
state = mergeDefaultProceduralTasksIntoState(state, mcId, 6, templates);
assert.equal(
  (state.proceduralTasks ?? []).find((t) => t.templateId === "a")?.dayIndex,
  5
);
assert.equal(
  (state.proceduralTasks ?? []).find((t) => t.templateId === "a")?.done,
  true
);

const nextTpl = setProceduralTemplateDefaultMatchDayOffset(templates, "c", null);
assert.equal(nextTpl.find((t) => t.id === "c")?.defaultMatchDayOffset, null);

const withCoach = setProceduralTemplateDefaultCoachId(templates, "a", "coach-1");
assert.equal(withCoach.find((t) => t.id === "a")?.defaultCoachId, "coach-1");
assert.equal(sanitizeOptionalCoachId(""), null);
assert.equal(sanitizeOptionalCoachId("  c1  "), "c1");

const fromCoach = proceduralTasksFromDefaults("mc1", 5, withCoach);
assert.equal(fromCoach.find((t) => t.templateId === "a")?.coachId, "coach-1");

const applied = applyCoachIdToProceduralTasks(fromCoach, "a", "coach-2");
assert.equal(applied.find((t) => t.templateId === "a")?.coachId, "coach-2");

const clearedTpl = clearCoachFromProceduralTemplates(withCoach, "coach-1");
assert.equal(clearedTpl.find((t) => t.id === "a")?.defaultCoachId, null);
const clearedTasks = clearCoachFromProceduralTasks(applied, "coach-2");
assert.equal(clearedTasks.find((t) => t.templateId === "a")?.coachId, null);

const dayList = proceduralTasksForDay(state.proceduralTasks, mcId, 5);
assert.ok(dayList.every((t) => t.dayIndex === 5));

const normalized = normalizeProceduralTasks([
  {
    id: "x",
    microcycleId: "mc",
    dayIndex: 2,
    templateId: "a",
    title: "Test",
    done: true,
    coachId: "c1",
  },
  { id: "", title: "bad" },
]);
assert.equal(normalized.length, 1);
assert.equal(normalized[0].done, true);
assert.equal(normalized[0].coachId, "c1");

console.log("proceduralTaskDefaults.test.ts: OK");
