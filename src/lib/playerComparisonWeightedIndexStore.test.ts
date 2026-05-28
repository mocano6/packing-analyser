import assert from "assert";
import {
  buildWeightedIndexFirestoreDocument,
  readWeightedIndexStateJson,
  readWeightedIndexUpdatedAt,
  WEIGHTED_INDEX_STORAGE_VERSION,
} from "./playerComparisonWeightedIndexStore";

const sampleStateJson = JSON.stringify({
  presets: [{ id: "preset-1", name: "Napastnik", configs: [] }],
  activePresetId: "preset-1",
  draftConfigs: [],
});

const doc = buildWeightedIndexFirestoreDocument(sampleStateJson, 1700000000000);
assert.strictEqual(doc.stateJson, sampleStateJson);
assert.strictEqual(doc.version, WEIGHTED_INDEX_STORAGE_VERSION);
assert.strictEqual(doc.updatedAt, 1700000000000);
assert.strictEqual(JSON.stringify(doc).includes("undefined"), false);

assert.equal(readWeightedIndexStateJson(doc as Record<string, unknown>), sampleStateJson);
assert.equal(readWeightedIndexUpdatedAt({ updatedAt: 999 }), 999);
assert.equal(readWeightedIndexUpdatedAt({ updatedAt: "bad" }), 0);
assert.equal(readWeightedIndexStateJson({ stateJson: "{}", version: 99 }), null);

console.log("playerComparisonWeightedIndexStore.test: OK");
