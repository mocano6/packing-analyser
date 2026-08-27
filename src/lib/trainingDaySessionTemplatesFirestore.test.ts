import assert from "assert";
import {
  buildTrainingDaySessionTemplatesTaskDocument,
  defaultTrainingDaySessionTemplatesState,
  migrateTrainingDaySessionTemplatesFromFirestore,
} from "./trainingDaySessionTemplatesFirestore";

const empty = defaultTrainingDaySessionTemplatesState();
assert.equal(empty.templates.length, 0);

const seeded = defaultTrainingDaySessionTemplatesState(true);
assert.equal(seeded.templates.length, 4);
assert.ok(seeded.templates.every((t) => t.name.trim() && t.blocks.length > 0));
assert.deepEqual(
  seeded.templates.map((t) => t.role),
  ["strength", "tension", "volume", "speed"]
);

const doc = buildTrainingDaySessionTemplatesTaskDocument(seeded, 123);
assert.strictEqual(doc.version, 1);
assert.strictEqual(typeof doc.stateJson, "string");

const migrated = migrateTrainingDaySessionTemplatesFromFirestore({
  stateJson: doc.stateJson,
  version: 1,
});
assert.equal(migrated.templates.length, seeded.templates.length);
assert.ok(migrated.templates.some((t) => t.gymCharacter === "heavy"));
assert.deepEqual(
  migrated.templates.map((t) => t.role),
  ["strength", "tension", "volume", "speed"]
);

// Biblioteka zapisana przed rolami: seedy per-offset ustępują zestawowi czterech jednostek
const legacyDoc = migrateTrainingDaySessionTemplatesFromFirestore({
  stateJson: JSON.stringify({
    templates: [
      {
        id: "seed-md-minus5",
        seedKey: "seed-md-minus5",
        name: "MD-5 — moc + intensywność krótka",
        matchDayOffset: -5,
        gymCharacter: "power",
        dominant: "tension",
        targets: { minutes: 100 },
        blocks: [{ name: "Siłownia moc", minutes: 30, tags: ["gym", "power"] }],
      },
      {
        id: "own-1",
        name: "Mój preset bramkarski",
        matchDayOffset: null,
        gymCharacter: "none",
        dominant: "activation",
        targets: { minutes: 40 },
        blocks: [{ name: "Praca z bramkarzami", minutes: 40, tags: ["mobility"] }],
      },
    ],
  }),
});
assert.equal(legacyDoc.templates.length, 5);
assert.deepEqual(
  legacyDoc.templates.slice(0, 4).map((t) => t.role),
  ["strength", "tension", "volume", "speed"]
);
assert.equal(legacyDoc.templates[4].name, "Mój preset bramkarski");

const fromEmpty = migrateTrainingDaySessionTemplatesFromFirestore({
  stateJson: JSON.stringify({ templates: [] }),
});
assert.equal(fromEmpty.templates.length, 0);

console.log("trainingDaySessionTemplatesFirestore.test.ts: OK");
