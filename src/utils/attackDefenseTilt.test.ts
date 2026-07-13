import assert from "node:assert/strict";
import { computeAttackDefenseTilt } from "./attackDefenseTilt";

const attackLean = computeAttackDefenseTilt(0.8, 0.2);
assert.equal(attackLean.direction, "attack");
assert.equal(Math.round(attackLean.attackShare), 80);
assert.ok(Math.abs(attackLean.diff - 0.6) < 1e-9);
assert.equal(Math.round(attackLean.magnitudePct), 60);

const defenseLean = computeAttackDefenseTilt(0.1, 0.9);
assert.equal(defenseLean.direction, "defense");
assert.equal(Math.round(defenseLean.defenseShare), 90);
assert.ok(defenseLean.tiltPct < 0);

const balanced = computeAttackDefenseTilt(0.5, 0.5);
assert.equal(balanced.direction, "balanced");
assert.equal(balanced.tiltPct, 0);

const empty = computeAttackDefenseTilt(0, 0);
assert.equal(empty.direction, "balanced");
assert.equal(empty.attackShare, 50);
assert.equal(empty.defenseShare, 50);

const negativeGuard = computeAttackDefenseTilt(-1, 0.4);
assert.equal(negativeGuard.attackXt, 0);
assert.equal(negativeGuard.direction, "defense");

console.log("attackDefenseTilt.test.ts: OK");
