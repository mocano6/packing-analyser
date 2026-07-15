import assert from "node:assert/strict";
import type { PossessionSegment } from "@/types";
import {
  buildCumulativePossessionChartData,
  buildPossession5MinChartData,
  buildPossessionTimeline,
  getPeriodMinuteRange,
  overlapSeconds,
  segmentToMatchMinutes,
  usesAbsoluteVideoSeconds,
} from "./possessionTimelineChart";

const legacySegments: PossessionSegment[] = [
  {
    id: "s1",
    type: "team",
    mode: "z",
    half: 1,
    startSec: 0,
    endSec: 300,
    durationSec: 300,
    startedAtVideoSec: 0,
    endedAtVideoSec: 300,
    createdAt: 1,
  },
  {
    id: "s2",
    type: "opponent",
    mode: "x",
    half: 1,
    startSec: 300,
    endSec: 600,
    durationSec: 300,
    startedAtVideoSec: 300,
    endedAtVideoSec: 600,
    createdAt: 2,
  },
  {
    id: "s3",
    type: "dead",
    mode: "c",
    half: 1,
    startSec: 600,
    endSec: 660,
    durationSec: 60,
    startedAtVideoSec: 600,
    endedAtVideoSec: 660,
    createdAt: 3,
  },
  {
    id: "s4",
    type: "team",
    mode: "z",
    half: 2,
    startSec: 0,
    endSec: 180,
    durationSec: 180,
    startedAtVideoSec: 0,
    endedAtVideoSec: 180,
    createdAt: 4,
  },
];

const legacyTimeline = buildPossessionTimeline(legacySegments);
assert.equal(legacyTimeline.absolute, false);
assert.equal(legacyTimeline.boundaryMin, 45);
assert.equal(legacyTimeline.endMin, 90);
assert.deepEqual(segmentToMatchMinutes(legacySegments[0], legacyTimeline), { startMin: 0, endMin: 5 });
assert.deepEqual(segmentToMatchMinutes(legacySegments[3], legacyTimeline), { startMin: 45, endMin: 48 });
assert.equal(overlapSeconds(legacySegments[0], 0, 3, legacyTimeline), 180);

const cumulativeLegacy = buildCumulativePossessionChartData(legacySegments, "total");
assert.equal(cumulativeLegacy.length, 91);
assert.equal(cumulativeLegacy.find((point) => point.minute === 5)?.teamPct, 100);
assert.equal(cumulativeLegacy.find((point) => point.minute === 48)?.teamSec, 480);

const SECOND_HALF_START = 2700;

const analyzerLikeSegments: PossessionSegment[] = [
  {
    id: "h1_team",
    type: "team",
    mode: "z",
    half: 1,
    startSec: 0,
    endSec: 1350,
    durationSec: 1350,
    startedAtVideoSec: 0,
    endedAtVideoSec: 1350,
    createdAt: 1,
  },
  {
    id: "h1_opp",
    type: "opponent",
    mode: "x",
    half: 1,
    startSec: 1350,
    endSec: SECOND_HALF_START,
    durationSec: SECOND_HALF_START - 1350,
    startedAtVideoSec: 1350,
    endedAtVideoSec: SECOND_HALF_START,
    createdAt: 2,
  },
  {
    id: "h2_team",
    type: "team",
    mode: "z",
    half: 2,
    startSec: SECOND_HALF_START,
    endSec: SECOND_HALF_START + 600,
    durationSec: 600,
    startedAtVideoSec: SECOND_HALF_START,
    endedAtVideoSec: SECOND_HALF_START + 600,
    createdAt: 3,
  },
  {
    id: "h2_opp",
    type: "opponent",
    mode: "x",
    half: 2,
    startSec: SECOND_HALF_START + 600,
    endSec: SECOND_HALF_START + 1200,
    durationSec: 600,
    startedAtVideoSec: SECOND_HALF_START + 600,
    endedAtVideoSec: SECOND_HALF_START + 1200,
    createdAt: 4,
  },
];

const timing = { secondHalfStartTime: SECOND_HALF_START };
const analyzerTimeline = buildPossessionTimeline(analyzerLikeSegments, timing);

assert.equal(usesAbsoluteVideoSeconds(analyzerLikeSegments, timing), true);
assert.equal(analyzerTimeline.absolute, true);
assert.equal(analyzerTimeline.boundaryMin, 45);
assert.deepEqual(segmentToMatchMinutes(analyzerLikeSegments[2], analyzerTimeline), { startMin: 45, endMin: 55 });
assert.deepEqual(segmentToMatchMinutes(analyzerLikeSegments[3], analyzerTimeline), { startMin: 55, endMin: 65 });

const cumulativeAnalyzer = buildCumulativePossessionChartData(analyzerLikeSegments, "total", timing);
const minute50 = cumulativeAnalyzer.find((point) => point.minute === 50);
assert.ok(minute50);
assert.equal(minute50.teamSec, 1350 + 300);
assert.equal(minute50.opponentSec, SECOND_HALF_START - 1350);
assert.ok(minute50.teamPct !== cumulativeAnalyzer.find((point) => point.minute === 44)?.teamPct);

const minute60 = cumulativeAnalyzer.find((point) => point.minute === 60);
assert.ok(minute60);
assert.equal(minute60.opponentSec, (SECOND_HALF_START - 1350) + 300);

const secondHalfBuckets = buildPossession5MinChartData(analyzerLikeSegments, "secondHalf", timing);
assert.equal(secondHalfBuckets.length, 9);
assert.equal(secondHalfBuckets[0]?.teamSec, 300);
assert.equal(secondHalfBuckets[2]?.opponentSec, 300);

const firstHalfBuckets = buildPossession5MinChartData(legacySegments, "firstHalf");
assert.equal(firstHalfBuckets.length, 9);
assert.equal(firstHalfBuckets[2]?.deadSec, 60);

const totalBuckets = buildPossession5MinChartData(analyzerLikeSegments, "total", timing);
assert.equal(totalBuckets.length, 18);
assert.equal(totalBuckets[9]?.minuteValue, 45);
assert.ok(totalBuckets[9]?.teamSec > 0);

assert.deepEqual(getPeriodMinuteRange("secondHalf", analyzerTimeline), { start: 45, end: 90 });
assert.deepEqual(getPeriodMinuteRange("total", analyzerTimeline), { start: 0, end: 90 });

// Doliczony czas: 1. połowa 47 min, 2. połowa 48 min → oś obejmuje 0–95 z granicą na 47'.
const STOPPAGE_SECOND_HALF_START = 47 * 60;
const stoppageSegments: PossessionSegment[] = [
  {
    id: "sh1",
    type: "team",
    mode: "z",
    half: 1,
    startSec: 0,
    endSec: STOPPAGE_SECOND_HALF_START,
    durationSec: STOPPAGE_SECOND_HALF_START,
    startedAtVideoSec: 0,
    endedAtVideoSec: STOPPAGE_SECOND_HALF_START,
    createdAt: 1,
  },
  {
    id: "sh2",
    type: "opponent",
    mode: "x",
    half: 2,
    startSec: STOPPAGE_SECOND_HALF_START,
    endSec: STOPPAGE_SECOND_HALF_START + 48 * 60,
    durationSec: 48 * 60,
    startedAtVideoSec: STOPPAGE_SECOND_HALF_START,
    endedAtVideoSec: STOPPAGE_SECOND_HALF_START + 48 * 60,
    createdAt: 2,
  },
];
const stoppageTiming = { firstHalfStartTime: 0, secondHalfStartTime: STOPPAGE_SECOND_HALF_START };
const stoppageTimeline = buildPossessionTimeline(stoppageSegments, stoppageTiming);
assert.equal(stoppageTimeline.boundaryMin, 47);
assert.equal(stoppageTimeline.endMin, 95);
assert.deepEqual(getPeriodMinuteRange("total", stoppageTimeline), { start: 0, end: 95 });
assert.deepEqual(segmentToMatchMinutes(stoppageSegments[1], stoppageTimeline), { startMin: 47, endMin: 95 });
const stoppageCumulative = buildCumulativePossessionChartData(stoppageSegments, "total", stoppageTiming);
assert.equal(stoppageCumulative[stoppageCumulative.length - 1]?.minute, 95);

console.log("possessionTimelineChart tests: OK");
