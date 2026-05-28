import assert from "node:assert/strict";
import {
  clearEmptyArrayPendingFields,
  getPendingField,
  setPendingMatchUpdate,
} from "./offlineMatchPending";

const store = new Map<string, string>();
(globalThis as unknown as { window: typeof globalThis }).window = globalThis;
// defineProperty (nie zwykłe przypisanie) — w nowszym Node localStorage bywa read-only globalem.
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  writable: true,
  value: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage,
});

store.clear();
assert.equal(setPendingMatchUpdate("m1", "actions_packing", []), true);
assert.deepEqual(getPendingField<unknown[]>("m1", "actions_packing"), []);
clearEmptyArrayPendingFields("m1", ["actions_packing"]);
assert.equal(getPendingField("m1", "actions_packing"), null);

assert.equal(setPendingMatchUpdate("m2", "actions_packing", [{ id: "a" }]), true);
clearEmptyArrayPendingFields("m2", ["actions_packing"]);
assert.ok(getPendingField<unknown[]>("m2", "actions_packing")?.length === 1);

console.log("offlineMatchPending tests: OK");
