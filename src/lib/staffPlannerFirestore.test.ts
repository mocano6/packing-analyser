import assert from "assert";
import { buildPlannerTaskDocument, buildSanitizedInnerState } from "./staffPlannerFirestore";
import type { StaffPlannerState } from "../types/staffPlanner";

const sample: StaffPlannerState = {
  coaches: [{ id: "c1", name: "A", color: "#000" }],
  templates: [
    {
      id: "t1",
      title: "Test",
      repeatable: true,
      defaultCoachId: null,
      categoryId: "taktyka",
    },
  ],
  assignments: [
    {
      id: "a1",
      weekStartIso: "2026-04-06",
      dayIndex: 2,
      coachId: "c1",
      title: "Zadanie",
      templateId: null,
      categoryId: "motoryka",
    },
  ],
  matchDays: [5],
};

const doc = buildPlannerTaskDocument(sample, 12345);
assert.strictEqual(typeof doc.stateJson, "string");
assert.strictEqual(doc.version, 2);
assert.strictEqual(JSON.stringify(doc).includes("undefined"), false);
const inner = JSON.parse(doc.stateJson as string);
const firstAssign = inner.assignments[0] as { templateId: unknown } | undefined;
assert.strictEqual(firstAssign?.templateId, null);

const withNan: StaffPlannerState = {
  ...sample,
  assignments: [
    {
      ...sample.assignments[0],
      dayIndex: Number.NaN as unknown as number,
    },
  ],
};
const innerSan = buildSanitizedInnerState(withNan);
assert.strictEqual((innerSan.assignments as { dayIndex: number }[])[0].dayIndex, 0);

console.log("staffPlannerFirestore.test: OK");
