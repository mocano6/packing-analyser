import assert from "assert";
import {
  formatMatchDayLabel,
  matchDayLabelForColumn,
  matchDayLabelsForColumn,
  matchDayOffset,
  normalizeMatchDaysArray,
  startOfWeekMonday,
  toIsoDateLocal,
  addDays,
  parseIsoDateLocal,
} from "./matchDayLabels";

assert.strictEqual(matchDayOffset(5, 5), 0);
assert.strictEqual(formatMatchDayLabel(0), "MD");
assert.strictEqual(formatMatchDayLabel(-1), "MD-1");
assert.strictEqual(formatMatchDayLabel(2), "MD+2");
assert.strictEqual(matchDayLabelForColumn(4, 5), "MD-1");
assert.strictEqual(matchDayLabelForColumn(5, 5), "MD");

const mon = startOfWeekMonday(new Date(2026, 3, 8));
assert.strictEqual(mon.getDay(), 1);
assert.strictEqual(toIsoDateLocal(mon), "2026-04-06");

const parsed = parseIsoDateLocal("2026-04-06");
assert.strictEqual(parsed.getFullYear(), 2026);
assert.strictEqual(parsed.getMonth(), 3);
assert.strictEqual(parsed.getDate(), 6);

assert.strictEqual(toIsoDateLocal(addDays(parsed, 6)), "2026-04-12");

assert.deepStrictEqual(normalizeMatchDaysArray([5, 2, 2]), [2, 5]);
assert.deepStrictEqual(normalizeMatchDaysArray([]), [5]);
assert.deepStrictEqual(
  matchDayLabelsForColumn(2, [2, 5]),
  ["MD", "MD-3"]
);

console.log("matchDayLabels.test: OK");
