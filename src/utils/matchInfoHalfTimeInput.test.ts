import assert from "node:assert/strict";
import {
  formatHalfSecondsDisplay,
  halfSecondsFromRaw,
  sanitizeHalfSecondsRaw,
} from "./matchInfoHalfTimeInput";

assert.equal(sanitizeHalfSecondsRaw("07"), "07");
assert.equal(sanitizeHalfSecondsRaw("7"), "7");
assert.equal(sanitizeHalfSecondsRaw("007"), "00");
assert.equal(sanitizeHalfSecondsRaw("a4b5c"), "45");

assert.equal(halfSecondsFromRaw(""), 0);
assert.equal(halfSecondsFromRaw("07"), 7);
assert.equal(halfSecondsFromRaw("00"), 0);
assert.equal(halfSecondsFromRaw("99"), 59);
assert.equal(halfSecondsFromRaw("61"), 59);

assert.equal(formatHalfSecondsDisplay(7), "07");
assert.equal(formatHalfSecondsDisplay(0), "00");
assert.equal(formatHalfSecondsDisplay(59), "59");

console.log("matchInfoHalfTimeInput tests: OK");
