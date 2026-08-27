import assert from "assert";
import {
  buildTrainingProceduralTaskTemplatesTaskDocument,
  defaultTrainingProceduralTaskTemplatesState,
  migrateTrainingProceduralTaskTemplatesFromFirestore,
} from "./trainingProceduralTaskTemplatesFirestore";

const empty = defaultTrainingProceduralTaskTemplatesState();
assert.equal(empty.templates.length, 0);

const seeded = defaultTrainingProceduralTaskTemplatesState(true);
assert.ok(seeded.templates.length >= 4);

const doc = buildTrainingProceduralTaskTemplatesTaskDocument(seeded, 123);
assert.strictEqual(doc.version, 1);
assert.strictEqual(typeof doc.stateJson, "string");

const migrated = migrateTrainingProceduralTaskTemplatesFromFirestore({
  stateJson: doc.stateJson,
  version: 1,
});
assert.equal(migrated.templates.length, seeded.templates.length);
assert.ok(migrated.templates.every((t) => t.title.trim()));

const withCoach = migrateTrainingProceduralTaskTemplatesFromFirestore({
  stateJson: JSON.stringify({
    templates: [
      {
        id: "t1",
        title: "Protokół",
        notes: "",
        defaultMatchDayOffset: -1,
        defaultCoachId: "c1",
      },
    ],
  }),
});
assert.equal(withCoach.templates[0]?.defaultCoachId, "c1");

const fromEmpty = migrateTrainingProceduralTaskTemplatesFromFirestore({
  stateJson: JSON.stringify({ templates: [] }),
});
assert.equal(fromEmpty.templates.length, 0);

console.log("trainingProceduralTaskTemplatesFirestore.test.ts: OK");
