import assert from "node:assert/strict";
import { isIn1TZoneCanonical, isInOpponent1TZoneCanonical } from "./pitchZones";

// Minimalny test jednostkowy bez frameworka (uruchamiany przez ts-node).
// Klucz: logika nie może zależeć od pitchOrientation/localStorage.

assert.equal(isIn1TZoneCanonical({ x: 95, y: 50 }), true);
assert.equal(isIn1TZoneCanonical({ x: 90, y: 39 }), true);
assert.equal(isIn1TZoneCanonical({ x: 100, y: 61 }), true);
assert.equal(isIn1TZoneCanonical({ x: 89.9, y: 50 }), false);
assert.equal(isIn1TZoneCanonical({ x: 95, y: 38.9 }), false);
assert.equal(isIn1TZoneCanonical({ x: 95, y: 61.1 }), false);

assert.equal(isInOpponent1TZoneCanonical({ x: 5, y: 50 }), true);
assert.equal(isInOpponent1TZoneCanonical({ x: 0, y: 39 }), true);
assert.equal(isInOpponent1TZoneCanonical({ x: 10, y: 61 }), true);
assert.equal(isInOpponent1TZoneCanonical({ x: 10.1, y: 50 }), false);
assert.equal(isInOpponent1TZoneCanonical({ x: 5, y: 38.9 }), false);
assert.equal(isInOpponent1TZoneCanonical({ x: 5, y: 61.1 }), false);

// smoke: string inputs should still work
assert.equal(isIn1TZoneCanonical({ x: "95", y: "50" }), true);

console.log("pitchZones tests: OK");

