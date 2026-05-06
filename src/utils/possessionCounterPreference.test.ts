import assert from "node:assert/strict";
import { isPossessionCounterEnabledStoredValue } from "./possessionCounterPreference";

assert.equal(isPossessionCounterEnabledStoredValue(null), true);
assert.equal(isPossessionCounterEnabledStoredValue(""), true);
assert.equal(isPossessionCounterEnabledStoredValue("true"), true);
assert.equal(isPossessionCounterEnabledStoredValue("false"), false);
