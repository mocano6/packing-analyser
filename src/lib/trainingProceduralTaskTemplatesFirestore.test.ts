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

const fromEmpty = migrateTrainingProceduralTaskTemplatesFromFirestore({
  stateJson: JSON.stringify({ templates: [] }),
});
assert.equal(fromEmpty.templates.length, 0);

console.log("trainingProceduralTaskTemplatesFirestore.test.ts: OK");
