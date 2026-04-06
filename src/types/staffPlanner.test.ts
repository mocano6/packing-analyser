import assert from "assert";
import { staffTaskCategoryLabel } from "./staffPlanner";

assert.strictEqual(staffTaskCategoryLabel("taktyka"), "Taktyka");
assert.strictEqual(staffTaskCategoryLabel("nieznane"), "nieznane");

console.log("staffPlanner.test: OK");
