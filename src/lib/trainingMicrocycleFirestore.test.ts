import assert from "assert";
import {
  buildSanitizedTrainingMicrocycleState,
  buildTrainingMicrocycleTaskDocument,
  extractDayTitleTemplatesFromMicrocycleRaw,
  migrateTrainingMicrocycleFromFirestore,
} from "./trainingMicrocycleFirestore";
import { createDefaultTrainingMicrocycleState } from "../utils/trainingMicrocycle";

const sample = createDefaultTrainingMicrocycleState(new Date("2026-07-13T12:00:00"));
const withAssign = {
  ...sample,
  assignments: [
    {
      id: "a1",
      microcycleId: sample.microcycles[0].id,
      dayIndex: 2,
      templateId: "tpl1",
      title: "Pressing",
      level: 1 as const,
    },
  ],
  trainingCounts: { tpl1: 1 },
};

const doc = buildTrainingMicrocycleTaskDocument(withAssign, 12345);
assert.strictEqual(typeof doc.stateJson, "string");
assert.strictEqual(doc.version, 5);

const innerDoc = JSON.parse(doc.stateJson as string);
assert.equal(innerDoc.dayTitleTemplates, undefined);

const legacyWithDayTitle = {
  seasons: sample.seasons,
  microcycles: sample.microcycles,
  assignments: [],
  dayTitleTemplates: [{ id: "dt1", generalFocus: "Dzień taktyczny", gameMoments: "Pressing, SFG" }],
  dayPlans: [
    {
      id: "dp1",
      microcycleId: sample.microcycles[0].id,
      dayIndex: 1,
      templateId: "dt1",
      generalFocus: "Dzień taktyczny",
      gameMoments: "Pressing, SFG",
    },
  ],
  trainingCounts: {},
  activeSeasonId: sample.activeSeasonId,
  activeMicrocycleId: sample.activeMicrocycleId,
};

const extracted = extractDayTitleTemplatesFromMicrocycleRaw(legacyWithDayTitle);
assert.equal(extracted.length, 1);
assert.equal(extracted[0].generalFocus, "Dzień taktyczny");

const migratedLegacy = migrateTrainingMicrocycleFromFirestore({
  stateJson: JSON.stringify(legacyWithDayTitle),
  version: 4,
});
assert.equal(migratedLegacy.dayPlans[0].generalFocus, "Dzień taktyczny");
assert.equal((migratedLegacy as { dayTitleTemplates?: unknown[] }).dayTitleTemplates, undefined);

const withSchedules = {
  ...sample,
  microcycles: [
    {
      ...sample.microcycles[0],
      daySchedules: [{ dayIndex: 2, startTime: "10:00", endTime: "12:00" }],
    },
  ],
};
const doc3 = buildTrainingMicrocycleTaskDocument(withSchedules, 1);
const migrated3 = migrateTrainingMicrocycleFromFirestore({ stateJson: doc3.stateJson, version: 5 });
assert.equal(migrated3.microcycles[0].daySchedules.length, 1);
assert.equal(migrated3.microcycles[0].daySchedules[0].startTime, "10:00");

const inner = buildSanitizedTrainingMicrocycleState({
  ...withAssign,
  assignments: [{ ...withAssign.assignments[0], dayIndex: Number.NaN as unknown as number }],
});
assert.strictEqual((inner.assignments as { dayIndex: number }[])[0].dayIndex, 0);

console.log("trainingMicrocycleFirestore.test.ts: OK");
