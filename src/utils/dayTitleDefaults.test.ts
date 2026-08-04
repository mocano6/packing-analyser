import assert from "assert";
import {
  dayIndexFromMatchDayOffset,
  dayPlansFromTitleDefaults,
  MATCH_DAY_GENERAL_FOCUS,
  mergeDefaultDayPlansIntoState,
  resolveDayTitleDisplay,
  sanitizeDayTitleMatchDayOffset,
  sanitizeDefaultMatchDayOffset,
  setTemplateDefaultMatchDayOffset,
} from "./dayTitleDefaults";
import { createDefaultTrainingMicrocycleState } from "./trainingMicrocycle";
import type { TrainingDayTitleTemplate } from "@/types/trainingMicrocycle";

assert.equal(sanitizeDefaultMatchDayOffset(-2), -2);
assert.equal(sanitizeDefaultMatchDayOffset("1"), 1);
assert.equal(sanitizeDefaultMatchDayOffset(""), null);
assert.equal(sanitizeDefaultMatchDayOffset(99), null);
assert.equal(sanitizeDefaultMatchDayOffset(0), 0);

// Tytuły dni: MD (0) nie jest przypisywalne — zawsze „Mecz”
assert.equal(sanitizeDayTitleMatchDayOffset(0), null);
assert.equal(sanitizeDayTitleMatchDayOffset(-1), -1);

assert.equal(dayIndexFromMatchDayOffset(5, -1), 4); // So → Pt
assert.equal(dayIndexFromMatchDayOffset(5, -2), 3);
assert.equal(dayIndexFromMatchDayOffset(1, -3), null); // poza tygodniem

{
  const locked = resolveDayTitleDisplay(true, {
    generalFocus: "High press",
    gameMoments: "SFG",
  });
  assert.deepEqual(locked, {
    generalFocus: MATCH_DAY_GENERAL_FOCUS,
    gameMoments: "",
    locked: true,
  });
  assert.equal(resolveDayTitleDisplay(true, null)?.generalFocus, "Mecz");
  assert.equal(resolveDayTitleDisplay(false, null), null);
  assert.equal(
    resolveDayTitleDisplay(false, { generalFocus: "PK", gameMoments: "" })?.locked,
    false
  );
}

const templates: TrainingDayTitleTemplate[] = [
  { id: "t1", generalFocus: "High press", gameMoments: "", defaultMatchDayOffset: -2 },
  { id: "t2", generalFocus: "PK", gameMoments: "", defaultMatchDayOffset: -1 },
  { id: "t3", generalFocus: "Wolne", gameMoments: "", defaultMatchDayOffset: null },
  { id: "tMd", generalFocus: "Custom MD", gameMoments: "", defaultMatchDayOffset: 0 },
];

const plans = dayPlansFromTitleDefaults("mc1", 5, templates);
assert.equal(plans.length, 2);
assert.equal(plans.find((p) => p.templateId === "t1")?.dayIndex, 3);
assert.equal(plans.find((p) => p.templateId === "t2")?.dayIndex, 4);
assert.equal(plans.find((p) => p.templateId === "tMd"), undefined);

{
  const state = createDefaultTrainingMicrocycleState(new Date("2026-07-13T12:00:00"));
  const mcId = state.microcycles[0].id;
  const next = mergeDefaultDayPlansIntoState(state, mcId, 5, templates);
  const dayPlans = next.dayPlans.filter((p) => p.microcycleId === mcId);
  assert.equal(dayPlans.length, 2);

  // Zmiana dnia meczu So→Nd przesuwa MD-1/MD-2
  const moved = mergeDefaultDayPlansIntoState(next, mcId, 6, templates);
  const movedPlans = moved.dayPlans.filter((p) => p.microcycleId === mcId);
  assert.equal(movedPlans.find((p) => p.templateId === "t1")?.dayIndex, 4);
  assert.equal(movedPlans.find((p) => p.templateId === "t2")?.dayIndex, 5);
}

{
  const updated = setTemplateDefaultMatchDayOffset(templates, "t3", -3);
  assert.equal(updated.find((t) => t.id === "t3")?.defaultMatchDayOffset, -3);
  const clearedMd = setTemplateDefaultMatchDayOffset(templates, "tMd", 0);
  assert.equal(clearedMd.find((t) => t.id === "tMd")?.defaultMatchDayOffset, null);
}

console.log("dayTitleDefaults.test.ts: OK");
