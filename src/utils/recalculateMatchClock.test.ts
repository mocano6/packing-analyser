import assert from "assert";
import type { Action, PossessionSegment, Shot } from "@/types";
import {
  applyMatchClockToEvent,
  describeMatchClockChanges,
  matchClockFromVideoSeconds,
  possessionMinutesFromSegments,
  reassignPossessionSegmentHalves,
  recalculateMatchRecording,
} from "./recalculateMatchClock";

const timing = { firstHalfStartTime: 120, secondHalfStartTime: 4000 };

assert.deepStrictEqual(matchClockFromVideoSeconds(120, timing), { minute: 1, isSecondHalf: false });
assert.deepStrictEqual(matchClockFromVideoSeconds(120 + 3 * 60 + 50, timing), {
  minute: 4,
  isSecondHalf: false,
});
assert.deepStrictEqual(matchClockFromVideoSeconds(4000, timing), { minute: 46, isSecondHalf: true });
assert.deepStrictEqual(matchClockFromVideoSeconds(4000 + 90, timing), { minute: 47, isSecondHalf: true });
// Oba starty ustawione: klatka przed I połową liczy się od zera nagrania (jak przy tagowaniu).
assert.deepStrictEqual(matchClockFromVideoSeconds(10, timing), { minute: 1, isSecondHalf: false });
assert.strictEqual(matchClockFromVideoSeconds(10, { firstHalfStartTime: 120 }), null);
assert.strictEqual(matchClockFromVideoSeconds(500, { firstHalfStartTime: 0, secondHalfStartTime: 0 }), null);

const onlySecond = matchClockFromVideoSeconds(90, { secondHalfStartTime: 4000 });
assert.deepStrictEqual(onlySecond, { minute: 2, isSecondHalf: false });

const action = {
  id: "a1",
  minute: 4,
  isSecondHalf: false,
  videoTimestampRaw: 4000 + 30,
} as Action;
const updatedAction = applyMatchClockToEvent(action, timing, { writeHalf: true });
assert.strictEqual(updatedAction.status, "updated");
assert.strictEqual(updatedAction.event.minute, 46);
assert.strictEqual(updatedAction.event.isSecondHalf, true);

const noVideo = applyMatchClockToEvent({ ...action, videoTimestampRaw: undefined }, timing, { writeHalf: true });
assert.strictEqual(noVideo.status, "skipped");
assert.strictEqual(noVideo.event.minute, 4);

const beforeKickoff = applyMatchClockToEvent(
  { ...action, videoTimestampRaw: 10 },
  { firstHalfStartTime: 120 },
  { writeHalf: true }
);
assert.strictEqual(beforeKickoff.status, "unchanged");
assert.strictEqual(beforeKickoff.event.minute, 4);

const shot = { id: "s1", minute: 12, videoTimestampRaw: 4000 + 61 } as Shot;
const updatedShot = applyMatchClockToEvent(shot, timing, { writeHalf: false });
assert.strictEqual(updatedShot.event.minute, 47);
assert.strictEqual("isSecondHalf" in updatedShot.event, false);

const segment = (
  id: string,
  startSec: number,
  endSec: number,
  half: 1 | 2,
  type: PossessionSegment["type"] = "team"
): PossessionSegment => ({
  id,
  type,
  mode: "z",
  half,
  startSec,
  endSec,
  durationSec: endSec - startSec,
  startedAtVideoSec: startSec,
  endedAtVideoSec: endSec,
  createdAt: 1,
});

const unchanged = reassignPossessionSegmentHalves([segment("p1", 200, 300, 1)], undefined);
assert.strictEqual(unchanged[0].half, 1);
assert.strictEqual(unchanged[0].id, "p1");

const split = reassignPossessionSegmentHalves([segment("cross", 3900, 4100, 1)], 4000);
assert.strictEqual(split.length, 2);
assert.strictEqual(split[0].half, 1);
assert.strictEqual(split[0].endSec, 4000);
assert.strictEqual(split[1].half, 2);
assert.strictEqual(split[1].startSec, 4000);
assert.strictEqual(split[0].startedAtVideoSec, 3900);
assert.strictEqual(split[1].endedAtVideoSec, 4100);

const relabeled = reassignPossessionSegmentHalves(
  [segment("late", 4100, 4200, 1, "opponent"), segment("later", 4200, 4300, 1, "opponent")],
  4000
);
assert.strictEqual(relabeled.length, 1);
assert.strictEqual(relabeled[0].half, 2);
assert.strictEqual(relabeled[0].startSec, 4100);
assert.strictEqual(relabeled[0].endSec, 4300);
assert.strictEqual(relabeled[0].id, "late");

const minutes = possessionMinutesFromSegments([segment("a", 0, 90, 1), segment("b", 0, 30, 2, "dead")]);
assert.strictEqual(minutes.teamFirstHalf, 1.5);
assert.strictEqual(minutes.deadSecondHalf, 0.5);

const recording = recalculateMatchRecording(
  {
    actions_packing: [action, { ...action, id: "a2", videoTimestampRaw: undefined, minute: 9 }],
    shots: [shot],
    possessionSegments: [segment("cross", 3900, 4100, 1)],
  },
  timing
);
assert.strictEqual(recording.updatedEvents, 2);
assert.strictEqual(recording.skippedWithoutVideoTime, 1);
assert.strictEqual(recording.actions_packing?.[1].minute, 9);
assert.strictEqual(recording.updatedSegments, 1);
assert.ok(recording.possession);

const preview = describeMatchClockChanges(
  {
    actions_packing: [
      { ...action, id: "keep", minute: 46, isSecondHalf: true, videoTimestampRaw: 4000 + 30, actionType: "pass" } as Action,
      { ...action, id: "move", minute: 4, isSecondHalf: false, videoTimestampRaw: 4000 + 30, actionType: "dribble" } as Action,
      { ...action, id: "novideo", minute: 9, isSecondHalf: false, videoTimestampRaw: undefined, actionType: "pass" } as Action,
    ],
    shots: [shot],
    possessionSegments: [segment("cross", 3900, 4100, 1), segment("late", 4100, 4200, 1, "opponent")],
  },
  timing
);
assert.strictEqual(preview.skippedWithoutVideoTime, 1);
assert.strictEqual(preview.rows.some((row) => row.id === "actions_packing:keep"), false);
assert.deepStrictEqual(
  preview.rows.find((row) => row.id === "actions_packing:move"),
  {
    id: "actions_packing:move",
    kind: "Packing · drybling",
    before: "P1 4'",
    after: "P2 46'",
    detail: "nagranie 67:10",
    playerId: undefined,
    videoSeconds: 4030,
  }
);
const shotRow = preview.rows.find((row) => row.id === "shots:s1");
assert.strictEqual(shotRow?.before, "P1 12'");
assert.strictEqual(shotRow?.after, "P2 47'");
assert.strictEqual(shotRow?.kind, "Strzał");
const splitRow = preview.rows.find((row) => row.id === "possession:cross");
assert.strictEqual(splitRow?.before, "P1 65:00–68:20");
assert.ok(splitRow?.after.includes("P1 65:00–66:40"));
assert.ok(splitRow?.after.includes("P2 66:40–68:20"));
const lateRow = preview.rows.find((row) => row.id === "possession:late");
assert.strictEqual(lateRow?.kind, "Posiadanie przeciwnika");
assert.strictEqual(lateRow?.before, "P1 68:20–70:00");
assert.strictEqual(lateRow?.after, "P2 68:20–70:00");

console.log("recalculateMatchClock.test: OK");
