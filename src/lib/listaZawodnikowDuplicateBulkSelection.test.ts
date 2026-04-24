import assert from "node:assert/strict";
import {
  filterActiveDuplicateIdsForBulkDelete,
  pruneDuplicateGroupBulkSelection,
} from "./listaZawodnikowDuplicateBulkSelection";

const grp = [
  { id: "a", isDeleted: false },
  { id: "b", isDeleted: true },
  { id: "c" },
];

assert.deepEqual(filterActiveDuplicateIdsForBulkDelete(["a", "b", "x", "a"], grp), ["a"]);
assert.deepEqual(filterActiveDuplicateIdsForBulkDelete([], grp), []);
assert.deepEqual(pruneDuplicateGroupBulkSelection(["a", "b"], grp), ["a"]);

console.log("listaZawodnikowDuplicateBulkSelection tests: OK");
