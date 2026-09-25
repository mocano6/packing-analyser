import assert from "assert";
import { normalizeWyscoutSearchResults } from "./service";

assert.deepEqual(normalizeWyscoutSearchResults(null), []);
assert.deepEqual(normalizeWyscoutSearchResults([{ name: "X" }]), []);
assert.equal(normalizeWyscoutSearchResults([{ wyId: 3193, name: "Genoa" }]).length, 1);
assert.equal(normalizeWyscoutSearchResults({ teams: [{ wyId: "10", name: "Lech" }] })[0]?.wyId, 10);

console.log("wyscout/service.test.ts: OK");
