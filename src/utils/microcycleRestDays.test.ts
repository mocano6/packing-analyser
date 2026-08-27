import assert from "assert";
import {
  isRestDay,
  moveRestDay,
  normalizeRestDays,
  defaultAmateurRestDays,
  setRestDay,
  swapRestDays,
} from "./microcycleRestDays";

assert.deepEqual(normalizeRestDays(undefined), []);
assert.deepEqual(normalizeRestDays("x"), []);
assert.deepEqual(normalizeRestDays([3, 3, 9, -1, "2", 2]), [2, 3]);

assert.equal(isRestDay([2], 2), true);
assert.equal(isRestDay([2], 3), false);
assert.equal(isRestDay(undefined, 2), false);

assert.deepEqual(setRestDay([], 4, true), [4]);
assert.deepEqual(setRestDay([1, 4], 4, true), [1, 4]);
assert.deepEqual(setRestDay([1, 4], 4, false), [1]);
assert.deepEqual(setRestDay([1], 9, true), [1]);

assert.deepEqual(swapRestDays([2], 2, 5), [5]);
assert.deepEqual(swapRestDays([2, 5], 2, 5), [2, 5]);
assert.deepEqual(swapRestDays([], 2, 5), []);
assert.deepEqual(swapRestDays([5], 2, 5), [2]);

assert.deepEqual(moveRestDay([2], 2, 5), [5]);
assert.deepEqual(moveRestDay([2, 5], 2, 5), [5]);
assert.deepEqual(moveRestDay([5], 2, 5), []);
assert.deepEqual(moveRestDay([], 2, 5), []);

assert.deepEqual(defaultAmateurRestDays([5]), [4, 6]);
assert.deepEqual(defaultAmateurRestDays([6]), [4, 5]);
assert.deepEqual(defaultAmateurRestDays([5, 6]), [4]);
assert.deepEqual(defaultAmateurRestDays([2]), [4, 5, 6]);

console.log("microcycleRestDays.test OK");
