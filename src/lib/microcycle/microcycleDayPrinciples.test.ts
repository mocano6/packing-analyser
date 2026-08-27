import assert from "assert";
import {
  AMATEUR_FOURTH_SESSION_DEFAULT,
  AMATEUR_KICKOFF_SESSION_TIME,
  AMATEUR_MODEL_EXCEPTIONS,
  AMATEUR_SATURDAY_SHIFT,
  AMATEUR_SESSION_PLACEMENT,
  AMATEUR_SUNDAY_DAY_GUIDES,
  AMATEUR_WEEK_SUMMARY_PRINCIPLES,
  groupAmateurPlacementByDay,
} from "./microcycleDayPrinciples";

assert.equal(AMATEUR_KICKOFF_SESSION_TIME, "18:00");
assert.equal(AMATEUR_SUNDAY_DAY_GUIDES.length, 7);
assert.deepEqual(
  AMATEUR_SUNDAY_DAY_GUIDES.map((d) => d.weekday),
  ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"]
);
assert.equal(new Set(AMATEUR_SUNDAY_DAY_GUIDES.map((d) => d.id)).size, 7);

const volume = AMATEUR_SUNDAY_DAY_GUIDES.find((d) => d.id === "volume");
const strength = AMATEUR_SUNDAY_DAY_GUIDES.find((d) => d.id === "strength");
const priming = AMATEUR_SUNDAY_DAY_GUIDES.find((d) => d.id === "priming");
assert.ok(volume && strength && priming);
assert.ok(volume.blocks.length >= 4);
assert.ok(strength.do.some((x) => x.toLowerCase().includes("nordic")));
assert.ok(priming.dont.some((x) => x.toLowerCase().includes("now")));
assert.ok(AMATEUR_FOURTH_SESSION_DEFAULT.toLowerCase().includes("sobota"));

assert.equal(AMATEUR_WEEK_SUMMARY_PRINCIPLES.length, 8);
assert.equal(AMATEUR_SESSION_PLACEMENT.length, 9);
const grouped = groupAmateurPlacementByDay(AMATEUR_SESSION_PLACEMENT);
assert.ok(grouped.length >= 3);
assert.equal(
  grouped.reduce((n, g) => n + g.topics.length, 0),
  AMATEUR_SESSION_PLACEMENT.length
);
const wtorek = grouped.find((g) => g.day === "Wtorek");
assert.ok(wtorek?.topics.some((t) => t.includes("Siła")));
assert.deepEqual(groupAmateurPlacementByDay([]), []);
assert.equal(AMATEUR_SATURDAY_SHIFT.length, 6);
assert.equal(AMATEUR_MODEL_EXCEPTIONS.length, 6);

for (const row of [
  ...AMATEUR_SESSION_PLACEMENT,
  ...AMATEUR_MODEL_EXCEPTIONS,
  ...AMATEUR_SATURDAY_SHIFT,
]) {
  for (const value of Object.values(row)) {
    assert.ok(String(value).trim().length > 0, "Pusty wpis w tabeli zasad");
  }
}

console.log("microcycleDayPrinciples.test OK");
