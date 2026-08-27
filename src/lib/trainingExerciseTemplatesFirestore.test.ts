import assert from "assert";
import {
  buildTrainingExerciseTemplatesTaskDocument,
  defaultTrainingExerciseTemplatesState,
  migrateTrainingExerciseTemplatesFromFirestore,
} from "./trainingExerciseTemplatesFirestore";

const empty = defaultTrainingExerciseTemplatesState();
assert.equal(empty.templates.length, 0);

const seeded = defaultTrainingExerciseTemplatesState(true);
assert.ok(seeded.templates.length >= 8);
assert.ok(seeded.templates.some((t) => t.kind === "gym"));
assert.ok(seeded.templates.some((t) => t.artificialTurfFocus));

const doc = buildTrainingExerciseTemplatesTaskDocument(seeded, 123);
assert.strictEqual(doc.version, 1);
assert.strictEqual(typeof doc.stateJson, "string");

const migrated = migrateTrainingExerciseTemplatesFromFirestore({
  stateJson: doc.stateJson,
  version: 1,
});
assert.equal(migrated.templates.length, seeded.templates.length);
assert.ok(migrated.templates.every((t) => t.name.trim()));

const fromEmpty = migrateTrainingExerciseTemplatesFromFirestore({
  stateJson: JSON.stringify({ templates: [] }),
});
assert.equal(fromEmpty.templates.length, 0);

const retired = migrateTrainingExerciseTemplatesFromFirestore({
  stateJson: JSON.stringify({
    templates: [
      { id: "n1", name: "Nordic Hamstring", kind: "gym", minutes: 8 },
      { id: "r1", name: "RDL / hip hinge", kind: "gym", minutes: 10 },
    ],
  }),
});
assert.deepEqual(
  retired.templates.map((t) => t.id),
  ["r1"]
);

console.log("trainingExerciseTemplatesFirestore.test.ts: OK");
