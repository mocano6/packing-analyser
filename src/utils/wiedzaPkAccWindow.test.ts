import assert from "node:assert/strict";
import { Acc8sEntry, PKEntry } from "@/types";
import {
  accEventVideoRawSeconds,
  summarizePkEntriesAgainstAcc,
} from "./wiedzaPkAccWindow";

function pk(overrides: Partial<PKEntry> = {}): PKEntry {
  return {
    id: "pk1",
    matchId: "m1",
    teamId: "t1",
    startX: 70,
    startY: 50,
    endX: 85,
    endY: 50,
    minute: 12,
    isSecondHalf: false,
    entryType: "pass",
    teamContext: "attack",
    timestamp: 1,
    videoTimestampRaw: 100,
    ...overrides,
  };
}

function acc(overrides: Partial<Acc8sEntry> = {}): Acc8sEntry {
  return {
    id: "acc1",
    matchId: "m1",
    teamId: "t1",
    minute: 12,
    isSecondHalf: false,
    teamContext: "attack",
    isShotUnder8s: false,
    isPKEntryUnder8s: false,
    passingPlayerIds: [],
    timestamp: 1,
    videoTimestampRaw: 100,
    ...overrides,
  };
}

(function testRawClockFallsBackToAdjustedPlusTen() {
  assert.equal(accEventVideoRawSeconds({ videoTimestampRaw: 80 }), 80);
  assert.equal(accEventVideoRawSeconds({ videoTimestamp: 70 }), 80);
  assert.equal(accEventVideoRawSeconds({}), null);
})();

(function testWindowsFromHalfCross() {
  const summary = summarizePkEntriesAgainstAcc(
    [
      pk({ id: "in8", videoTimestampRaw: 105 }),
      pk({ id: "edge8", videoTimestampRaw: 108 }),
      pk({ id: "in15", videoTimestampRaw: 114 }),
      pk({ id: "edge15", videoTimestampRaw: 115 }),
      pk({ id: "late", videoTimestampRaw: 116 }),
      pk({ id: "before", videoTimestampRaw: 90 }),
      pk({ id: "other-side", teamContext: "defense", videoTimestampRaw: 104 }),
      pk({ id: "other-match", matchId: "m2", videoTimestampRaw: 104 }),
      pk({ id: "no-clock", videoTimestampRaw: undefined, videoTimestamp: undefined }),
    ],
    [acc({ videoTimestampRaw: 100 })],
  );

  assert.equal(summary.within8s, 2);
  assert.equal(summary.within15s, 4);
  assert.ok(summary.idsWithin8s.has("in8"));
  assert.ok(summary.idsWithin8s.has("edge8"));
  assert.ok(!summary.idsWithin8s.has("in15"));
  assert.ok(summary.idsWithin15s.has("in15"));
  assert.ok(summary.idsWithin15s.has("edge15"));
  assert.ok(!summary.idsWithin15s.has("late"));
  assert.equal(summary.totalEntries, 9);
})();

(function testClosestPrecedingAccWins() {
  const summary = summarizePkEntriesAgainstAcc(
    [pk({ id: "pk", videoTimestampRaw: 130 })],
    [
      acc({ id: "early", videoTimestampRaw: 100 }),
      acc({ id: "near", videoTimestampRaw: 125 }),
    ],
  );
  assert.equal(summary.within8s, 1);
  assert.equal(summary.within15s, 1);
})();

console.log("wiedzaPkAccWindow.test: OK");
