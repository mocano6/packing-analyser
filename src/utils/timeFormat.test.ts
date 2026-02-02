import assert from "node:assert/strict";
import { formatMMSS, minutesDecimalToSeconds, secondsToMinutesDecimal } from "./timeFormat";

assert.equal(formatMMSS(0), "00:00");
assert.equal(formatMMSS(5), "00:05");
assert.equal(formatMMSS(65), "01:05");
assert.equal(formatMMSS(-10), "00:00");

assert.equal(minutesDecimalToSeconds(undefined), 0);
assert.equal(minutesDecimalToSeconds(0), 0);
assert.equal(minutesDecimalToSeconds(1), 60);
assert.equal(minutesDecimalToSeconds(1.5), 90);

assert.equal(secondsToMinutesDecimal(0), 0);
assert.equal(secondsToMinutesDecimal(60), 1);
assert.equal(secondsToMinutesDecimal(90), 1.5);

console.log("timeFormat tests: OK");

