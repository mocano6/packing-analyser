import assert from "assert";
import {
  DEFAULT_POSITION_PHASE_VIEW,
  parsePositionPhaseViewMode,
  POSITION_PHASE_VIEW_STORAGE_KEY,
  readPositionPhaseViewMode,
  writePositionPhaseViewMode,
} from "./positionPhaseViewPreference";

assert.equal(parsePositionPhaseViewMode("graph"), "graph");
assert.equal(parsePositionPhaseViewMode("list"), "list");
assert.equal(parsePositionPhaseViewMode("tree"), null);
assert.equal(parsePositionPhaseViewMode(null), null);

const store = new Map<string, string>();
(globalThis as unknown as { window: { localStorage: Storage } }).window = {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  },
};

assert.equal(readPositionPhaseViewMode(), DEFAULT_POSITION_PHASE_VIEW);
writePositionPhaseViewMode("list");
assert.equal(store.get(POSITION_PHASE_VIEW_STORAGE_KEY), "list");
assert.equal(readPositionPhaseViewMode(), "list");

console.log("positionPhaseViewPreference.test.ts: OK");
