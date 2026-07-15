import assert from "assert";
import {
  adminZadaniaTabStorageKey,
  parseAdminZadaniaTab,
  readAdminZadaniaTab,
  writeAdminZadaniaTab,
} from "./adminZadaniaTabPreference";

assert.equal(parseAdminZadaniaTab("model"), "model");
assert.equal(parseAdminZadaniaTab("microcycle"), "microcycle");
assert.equal(parseAdminZadaniaTab("invalid"), null);

assert.equal(adminZadaniaTabStorageKey("user-1"), "adminZadania_activeTab_user-1");
assert.equal(adminZadaniaTabStorageKey(null), "adminZadania_activeTab");

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

writeAdminZadaniaTab("user-abc", "eisenhower");
assert.equal(readAdminZadaniaTab("user-abc"), "eisenhower");
assert.equal(readAdminZadaniaTab("other-user"), "planner");

console.log("adminZadaniaTabPreference.test.ts: OK");
