import assert from "assert";
import { nextCoachColor, staffTaskCategoryLabel } from "./staffPlanner";

assert.strictEqual(staffTaskCategoryLabel("taktyka"), "Taktyka");
assert.strictEqual(staffTaskCategoryLabel("nieznane"), "nieznane");
assert.strictEqual(nextCoachColor(0), "#2563eb");
assert.strictEqual(nextCoachColor(8), "#2563eb");
assert.strictEqual(nextCoachColor(1), "#dc2626");

console.log("staffPlanner.test: OK");
