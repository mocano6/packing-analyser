import assert from "node:assert/strict";
import { ensureEachEntryHasId } from "./ensureMatchArrayIds";

const withIds = ensureEachEntryHasId([{ id: "a", n: 1 }, { n: 2 } as { id?: string; n: number }]);
assert.equal(withIds[0].id, "a");
assert.ok(typeof withIds[1].id === "string" && withIds[1].id.length > 10);

const empty = ensureEachEntryHasId([]);
assert.deepEqual(empty, []);

console.log("ensureMatchArrayIds tests: OK");
