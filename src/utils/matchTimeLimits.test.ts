import assert from "assert";
import {
  FIRST_HALF_END_MINUTE,
  MAX_MATCH_MINUTE,
  MAX_VIDEO_TIME_MINUTES,
  SECOND_HALF_START_MINUTE,
  clampFirstHalfMinute,
  clampMatchMinute,
  clampSecondHalfMinute,
  clampVideoTimeMinutes,
  formatVideoMinutesAsMMSS,
} from "./matchTimeLimits";

assert.strictEqual(MAX_MATCH_MINUTE, 200);
assert.strictEqual(MAX_VIDEO_TIME_MINUTES, 200);
assert.strictEqual(FIRST_HALF_END_MINUTE, 45);
assert.strictEqual(SECOND_HALF_START_MINUTE, 46);

assert.strictEqual(clampFirstHalfMinute(1), 1);
assert.strictEqual(clampFirstHalfMinute(45), 45);
assert.strictEqual(clampFirstHalfMinute(60), 45);
assert.strictEqual(clampFirstHalfMinute(0), 1);

assert.strictEqual(clampSecondHalfMinute(46), 46);
assert.strictEqual(clampSecondHalfMinute(90), 90);
assert.strictEqual(clampSecondHalfMinute(120), 120);
assert.strictEqual(clampSecondHalfMinute(200), 200);
assert.strictEqual(clampSecondHalfMinute(250), 200);
assert.strictEqual(clampSecondHalfMinute(40), 46);

assert.strictEqual(clampMatchMinute(30, false), 30);
assert.strictEqual(clampMatchMinute(100, true), 100);
assert.strictEqual(clampMatchMinute(201, true), 200);

assert.strictEqual(clampVideoTimeMinutes(0), 0);
assert.strictEqual(clampVideoTimeMinutes(99), 99);
assert.strictEqual(clampVideoTimeMinutes(200), 200);
assert.strictEqual(clampVideoTimeMinutes(201), 200);
assert.strictEqual(clampVideoTimeMinutes(-5), 0);

assert.strictEqual(formatVideoMinutesAsMMSS(5), "05:00");
assert.strictEqual(formatVideoMinutesAsMMSS(99, 3), "99:03");
assert.strictEqual(formatVideoMinutesAsMMSS(150, 45), "150:45");
assert.strictEqual(formatVideoMinutesAsMMSS(200, 59), "200:59");
assert.strictEqual(formatVideoMinutesAsMMSS(250, 10), "200:10");

console.log("matchTimeLimits.test.ts: ok");
