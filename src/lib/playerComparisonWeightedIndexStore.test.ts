import assert from "assert";
import {
  buildSharedWeightedIndexPresetsDocument,
  buildWeightedIndexFirestoreDocument,
  readSharedWeightedIndexPresets,
  readWeightedIndexStateJson,
  readWeightedIndexUpdatedAt,
  resolveSharedWeightedIndexPresets,
  WEIGHTED_INDEX_SHARED_PRESETS_DOC_ID,
  WEIGHTED_INDEX_STORAGE_VERSION,
} from "./playerComparisonWeightedIndexStore";
import type { PlayerComparisonWeightedIndexPreset } from "@/utils/playerComparisonWeightedIndexPreferences";
import { buildDefaultWeightedIndexConfigs } from "@/utils/playerComparisonWeightedIndexPreferences";

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

const samplePreset: PlayerComparisonWeightedIndexPreset = {
  id: "preset-wah",
  name: "Wahadłowy",
  configs: buildDefaultWeightedIndexConfigs(),
  selectedPositions: ["LB", "RB"],
};

const sharedDoc = buildSharedWeightedIndexPresetsDocument([samplePreset], 1700000001000);
assert.strictEqual(sharedDoc.version, WEIGHTED_INDEX_STORAGE_VERSION);
assert.strictEqual(sharedDoc.updatedAt, 1700000001000);
assert.ok(typeof sharedDoc.presetsJson === "string" && sharedDoc.presetsJson.includes("Wahadłowy"));
assert.strictEqual(WEIGHTED_INDEX_SHARED_PRESETS_DOC_ID, "playerComparisonWeightedIndexPresets");

const readBack = readSharedWeightedIndexPresets(sharedDoc as unknown as Record<string, unknown>);
assert.ok(readBack);
assert.equal(readBack!.length, 1);
assert.equal(readBack![0]!.id, "preset-wah");
assert.equal(readBack![0]!.name, "Wahadłowy");
assert.deepEqual(readBack![0]!.selectedPositions, ["LB", "RB"]);

assert.equal(readSharedWeightedIndexPresets(null), null);
assert.equal(readSharedWeightedIndexPresets({ presetsJson: "{}", version: 99 }), null);
assert.equal(readSharedWeightedIndexPresets({ version: 1 }), null);

const seeded = resolveSharedWeightedIndexPresets({
  isAdmin: true,
  sharedPresets: null,
  privatePresets: [samplePreset],
  localPresets: [],
});
assert.equal(seeded.shouldWriteShared, true);
assert.equal(seeded.presets[0]!.name, "Wahadłowy");

const seededFromLocal = resolveSharedWeightedIndexPresets({
  isAdmin: true,
  sharedPresets: [],
  privatePresets: [],
  localPresets: [samplePreset],
});
assert.equal(seededFromLocal.shouldWriteShared, true);
assert.equal(seededFromLocal.presets.length, 1);

const nonAdminEmptyShared = resolveSharedWeightedIndexPresets({
  isAdmin: false,
  sharedPresets: null,
  privatePresets: [samplePreset],
  localPresets: [samplePreset],
});
assert.equal(nonAdminEmptyShared.shouldWriteShared, false);
assert.deepEqual(nonAdminEmptyShared.presets, []);

const sharedWins = resolveSharedWeightedIndexPresets({
  isAdmin: true,
  sharedPresets: [{ ...samplePreset, id: "shared-1", name: "ŚO" }],
  privatePresets: [samplePreset],
  localPresets: [samplePreset],
});
assert.equal(sharedWins.shouldWriteShared, false);
assert.equal(sharedWins.presets[0]!.name, "ŚO");

const adminNoCandidates = resolveSharedWeightedIndexPresets({
  isAdmin: true,
  sharedPresets: [],
  privatePresets: [],
  localPresets: [],
});
assert.equal(adminNoCandidates.shouldWriteShared, false);
assert.deepEqual(adminNoCandidates.presets, []);

console.log("playerComparisonWeightedIndexStore.test: OK");
