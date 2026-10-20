import assert from "node:assert/strict";
import {
  GOALKEEPER_OUT_XG_BONUS_PERCENT,
  applyGoalkeeperOutXgBoost,
  reverseGoalkeeperOutXgBoost,
} from "./shotGoalkeeperOutXg";

assert.equal(GOALKEEPER_OUT_XG_BONUS_PERCENT, 15);

assert.equal(applyGoalkeeperOutXgBoost(5, false), 5);
assert.equal(reverseGoalkeeperOutXgBoost(20, false), 20);

assert.equal(applyGoalkeeperOutXgBoost(5, true), 20);
assert.equal(applyGoalkeeperOutXgBoost(20, true), 35);
assert.equal(applyGoalkeeperOutXgBoost(76, true), 91);
assert.equal(applyGoalkeeperOutXgBoost(0, true), 15);

assert.equal(reverseGoalkeeperOutXgBoost(applyGoalkeeperOutXgBoost(5, true), true), 5);
assert.equal(reverseGoalkeeperOutXgBoost(applyGoalkeeperOutXgBoost(19, true), true), 19);

const rounded = Math.max(1, Math.round(applyGoalkeeperOutXgBoost(5, true)));
assert.equal(rounded, 20);
assert.equal(Math.max(1, Math.round(reverseGoalkeeperOutXgBoost(rounded, true))), 5);

const penaltyRounded = Math.max(1, Math.round(applyGoalkeeperOutXgBoost(76, true)));
assert.equal(penaltyRounded, 91);
assert.equal(Math.max(1, Math.round(reverseGoalkeeperOutXgBoost(penaltyRounded, true))), 76);

console.log("shotGoalkeeperOutXg.test: OK");
