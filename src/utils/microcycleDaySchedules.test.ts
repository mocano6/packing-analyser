import assert from "assert";
import {
  addMinutesToHhmm,
  getDayScheduleForDay,
  normalizeMicrocycleDaySchedules,
  updateMicrocycleDaySchedule,
} from "./microcycleDaySchedules";

assert.deepEqual(getDayScheduleForDay(undefined, 2), {
  dayIndex: 2,
  startTime: "",
  endTime: "",
});

const normalized = normalizeMicrocycleDaySchedules([
  { dayIndex: 1, startTime: "9:30", endTime: "11:00" },
  { dayIndex: 5, startTime: "10:00", endTime: "" },
  { dayIndex: 3, startTime: "invalid", endTime: "12:00" },
]);
assert.equal(normalized.length, 3);
assert.equal(normalized.find((s) => s.dayIndex === 1)?.startTime, "09:30");
assert.equal(normalized.find((s) => s.dayIndex === 3)?.endTime, "12:00");

const updated = updateMicrocycleDaySchedule([], 4, { startTime: "10:00", endTime: "12:30" });
assert.equal(updated.length, 1);
assert.equal(updated[0].startTime, "10:00");

const cleared = updateMicrocycleDaySchedule(updated, 4, { startTime: "", endTime: "" });
assert.equal(cleared.length, 0);

assert.equal(addMinutesToHhmm("18:00", 90), "19:30");
assert.equal(addMinutesToHhmm("23:45", 30), "00:15");
assert.equal(addMinutesToHhmm("09:30", 0), "09:30");
assert.equal(addMinutesToHhmm("", 60), null);
assert.equal(addMinutesToHhmm("18:00", -5), null);

console.log("microcycleDaySchedules.test.ts: OK");
