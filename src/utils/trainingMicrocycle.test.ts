import assert from "assert";
import {
  applyTrainingCountDelta,
  assignTemplatesToMicrocycleDay,
  createDefaultTrainingMicrocycleState,
  generateMicrocycleId,
  microcyclesForSeason,
  moveAssignmentToDay,
  nextMicrocycleNumber,
  renumberSeasonMicrocycles,
  uniqueAssignmentsPerDay,
  uniqueAssignmentsPerDayAdjustingCounts,
  removeTemplateFromMicrocycleDay,
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

{
  const microcycleId = defaultState.activeMicrocycleId!;
  let ids = 0;
  const next = assignTemplatesToMicrocycleDay(defaultState, {
    microcycleId,
    dayIndex: 2,
    templates: [
      { id: "t-rule", title: "Pressing", level: 0 },
      { id: "t-sub", title: "Pressing po stracie", level: 1 },
    ],
    generateId: () => `id-${++ids}`,
  });
  assert.equal(next.assignments.length, 2);
  assert.equal(next.assignments[0].id, "id-1");
  assert.equal(next.assignments[0].templateId, "t-rule");
  assert.equal(next.assignments[0].dayIndex, 2);
  assert.equal(next.assignments[1].templateId, "t-sub");
  assert.equal(next.trainingCounts["t-rule"], 1);
  assert.equal(next.trainingCounts["t-sub"], 1);
  const again = assignTemplatesToMicrocycleDay(next, {
    microcycleId,
    dayIndex: 2,
    templates: [
      { id: "t-rule", title: "Pressing", level: 0 },
      { id: "t-sub", title: "Pressing po stracie", level: 1 },
      { id: "t-sub2", title: "Trigger pressingu", level: 1 },
    ],
    generateId: () => `id-${++ids}`,
  });
  assert.equal(again.assignments.length, 3);
  assert.equal(again.assignments.filter((a) => a.templateId === "t-sub").length, 1);
  assert.equal(again.assignments.some((a) => a.templateId === "t-sub2"), true);
  assert.equal(again.trainingCounts["t-rule"], 1);
  assert.equal(again.trainingCounts["t-sub"], 1);
  assert.equal(again.trainingCounts["t-sub2"], 1);
  const empty = assignTemplatesToMicrocycleDay(defaultState, {
    microcycleId,
    dayIndex: 1,
    templates: [],
  });
  assert.equal(empty, defaultState);

  const otherDay = assignTemplatesToMicrocycleDay(again, {
    microcycleId,
    dayIndex: 3,
    templates: [{ id: "t-rule", title: "Pressing", level: 0 }],
    generateId: () => `id-${++ids}`,
  });
  assert.equal(otherDay.assignments.filter((a) => a.templateId === "t-rule").length, 2);
  assert.equal(otherDay.trainingCounts["t-rule"], 2);

  const withDupes = uniqueAssignmentsPerDay([
    {
      id: "a1",
      microcycleId,
      dayIndex: 2,
      templateId: "t-sub",
      title: "A",
      level: 1,
    },
    {
      id: "a2",
      microcycleId,
      dayIndex: 2,
      templateId: "t-sub",
      title: "A",
      level: 1,
    },
    {
      id: "a3",
      microcycleId,
      dayIndex: 3,
      templateId: "t-sub",
      title: "A",
      level: 1,
    },
  ]);
  assert.deepEqual(
    withDupes.map((a) => a.id),
    ["a1", "a3"]
  );
  const adjusted = uniqueAssignmentsPerDayAdjustingCounts(
    [
      {
        id: "a1",
        microcycleId,
        dayIndex: 2,
        templateId: "t-sub",
        title: "A",
        level: 1,
      },
      {
        id: "a2",
        microcycleId,
        dayIndex: 2,
        templateId: "t-sub",
        title: "A",
        level: 1,
      },
    ],
    { "t-sub": 2 }
  );
  assert.equal(adjusted.assignments.length, 1);
  assert.equal(adjusted.trainingCounts["t-sub"], 1);

  const moved = moveAssignmentToDay(otherDay, otherDay.assignments[0].id, 4);
  assert.equal(moved.assignments.find((a) => a.id === otherDay.assignments[0].id)?.dayIndex, 4);
  const clashMove = moveAssignmentToDay(
    {
      ...otherDay,
      assignments: [
        {
          id: "keep",
          microcycleId,
          dayIndex: 5,
          templateId: "t-rule",
          title: "Pressing",
          level: 0,
        },
        {
          id: "moving",
          microcycleId,
          dayIndex: 2,
          templateId: "t-rule",
          title: "Pressing",
          level: 0,
        },
      ],
      trainingCounts: { "t-rule": 2 },
    },
    "moving",
    5
  );
  assert.equal(clashMove.assignments.length, 1);
  assert.equal(clashMove.assignments[0].id, "keep");
  assert.equal(clashMove.trainingCounts["t-rule"], 1);

  const removedDup = removeTemplateFromMicrocycleDay(
    {
      ...otherDay,
      assignments: [
        {
          id: "keep-day",
          microcycleId,
          dayIndex: 2,
          templateId: "t-sub",
          title: "A",
          level: 1,
        },
        {
          id: "dup-day",
          microcycleId,
          dayIndex: 2,
          templateId: "t-sub",
          title: "A",
          level: 1,
        },
        {
          id: "other-day",
          microcycleId,
          dayIndex: 3,
          templateId: "t-sub",
          title: "A",
          level: 1,
        },
      ],
      trainingCounts: { "t-sub": 3 },
    },
    "dup-day"
  );
  assert.equal(removedDup.assignments.length, 1);
  assert.equal(removedDup.assignments[0].id, "other-day");
  assert.equal(removedDup.trainingCounts["t-sub"], 1);
}

console.log("trainingMicrocycle.test.ts: OK");
