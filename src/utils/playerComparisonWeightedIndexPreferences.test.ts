import assert from "node:assert/strict";
import {
  buildDefaultWeightedIndexStorage,
  deleteWeightedIndexPreset,
  parsePlayerComparisonWeightedIndexStorage,
  serializePlayerComparisonWeightedIndexStorage,
  upsertWeightedIndexPreset,
} from "./playerComparisonWeightedIndexPreferences";
import { sanitizeWeightedIndexConfigs } from "./playerComparisonWeightedIndex";

const sampleConfigs = sanitizeWeightedIndexConfigs([
  { metricId: "pxtSender", enabled: true, weight: 60, betterWhen: "higher" },
  { metricId: "xtSender", enabled: true, weight: 40, betterWhen: "higher" },
]);

const legacy = serializePlayerComparisonWeightedIndexStorage({
  presets: [],
  activePresetId: null,
  draftConfigs: sampleConfigs,
});

const migrated = parsePlayerComparisonWeightedIndexStorage(
  JSON.stringify([
    { axisId: "pxt", enabled: true, weight: 25 },
    { axisId: "xg", enabled: true, weight: 75 },
  ]),
);
assert.equal(migrated.presets.length, 0);
assert.equal(migrated.draftConfigs.find((c) => c.metricId === "pxtSender")?.weight, 25);
assert.equal(migrated.draftConfigs.find((c) => c.metricId === "xg")?.weight, 75);

const partial = parsePlayerComparisonWeightedIndexStorage(
  JSON.stringify({
    presets: [],
    activePresetId: null,
    draftConfigs: [
      { metricId: "pxtSender", enabled: true, weight: 15 },
      { metricId: "xtSender", enabled: true, weight: 10 },
    ],
  }),
);
assert.equal(
  partial.draftConfigs.filter((c) => c.enabled).reduce((sum, c) => sum + c.weight, 0),
  25,
);

let storage = buildDefaultWeightedIndexStorage();
const saved = upsertWeightedIndexPreset(storage.presets, "  Napastnik  ", sampleConfigs, ["ST", "LW"]);
storage = { ...storage, presets: saved.presets, activePresetId: saved.presetId };
assert.equal(storage.presets.length, 1);
assert.equal(storage.presets[0]?.name, "Napastnik");
assert.deepEqual(storage.presets[0]?.selectedPositions, ["ST", "LW"]);

const updated = upsertWeightedIndexPreset(storage.presets, "napastnik", sanitizeWeightedIndexConfigs([
  { metricId: "xg", enabled: true, weight: 100, betterWhen: "higher" },
]), ["GK"]);
assert.equal(updated.presets.length, 1);
assert.equal(updated.presets[0]?.configs.find((c) => c.metricId === "xg")?.enabled, true);
assert.deepEqual(updated.presets[0]?.selectedPositions, ["GK"]);

storage = {
  ...storage,
  presets: updated.presets,
  draftConfigs: updated.presets[0]!.configs,
};
const serialized = serializePlayerComparisonWeightedIndexStorage(storage);
const parsed = parsePlayerComparisonWeightedIndexStorage(serialized);
assert.equal(parsed.presets.length, 1);
assert.equal(parsed.activePresetId, storage.activePresetId);
assert.deepEqual(parsed.presets[0]?.selectedPositions, ["GK"]);
assert.equal(parsed.draftConfigs.find((c) => c.metricId === "xg")?.weight, 100);
assert.equal(parsed.draftConfigs.find((c) => c.metricId === "loses")?.betterWhen, "lower");

const migratedBetterWhen = parsePlayerComparisonWeightedIndexStorage(
  JSON.stringify({
    presets: [],
    activePresetId: null,
    draftConfigs: [{ metricId: "loses", enabled: true, weight: 50, betterWhen: "lower" }],
  }),
);
assert.equal(migratedBetterWhen.draftConfigs.find((c) => c.metricId === "loses")?.betterWhen, "lower");

const legacyPresetWithoutPositions = parsePlayerComparisonWeightedIndexStorage(
  JSON.stringify({
    presets: [
      {
        id: "legacy-1",
        name: "Legacy",
        configs: [{ metricId: "xg", enabled: true, weight: 100, betterWhen: "higher" }],
      },
    ],
    activePresetId: "legacy-1",
    draftConfigs: [],
  }),
);
assert.deepEqual(legacyPresetWithoutPositions.presets[0]?.selectedPositions, []);

const afterDelete = deleteWeightedIndexPreset(parsed.presets, parsed.presets[0]!.id);
assert.equal(afterDelete.length, 0);

const privateDraftWithSharedActiveId = parsePlayerComparisonWeightedIndexStorage(
  JSON.stringify({
    presets: [],
    activePresetId: "shared-preset-id",
    draftConfigs: [{ metricId: "xg", enabled: true, weight: 100, betterWhen: "higher" }],
  }),
);
assert.equal(privateDraftWithSharedActiveId.presets.length, 0);
assert.equal(privateDraftWithSharedActiveId.activePresetId, "shared-preset-id");

console.log("playerComparisonWeightedIndexPreferences.test: ok");
