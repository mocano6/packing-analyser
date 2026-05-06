import assert from "node:assert/strict";
import {
  buildPossessionLivePlayBlocks,
  buildPossessionLivePlayBuckets,
  buildPossessionLivePlayBucketChartRows,
  summarizePossessionLivePlayBlocks,
  type PossessionLivePlaySource,
} from "./possessionLivePlay";

const source: PossessionLivePlaySource = {
  matchId: "m1",
  matchLabel: "Team vs Opp",
  teamName: "Team",
  opponentName: "Opp",
  date: "2026-05-05",
  competition: "League",
  segments: [
    { id: "s1", type: "team", mode: "z", half: 1, startSec: 0, endSec: 12, durationSec: 12, startedAtVideoSec: 0, endedAtVideoSec: 12, createdAt: 1 },
    { id: "s2", type: "opponent", mode: "x", half: 1, startSec: 12, endSec: 31, durationSec: 19, startedAtVideoSec: 12, endedAtVideoSec: 31, createdAt: 2 },
    { id: "s3", type: "dead", mode: "c", half: 1, startSec: 31, endSec: 42, durationSec: 11, startedAtVideoSec: 31, endedAtVideoSec: 42, createdAt: 3 },
    { id: "s4", type: "team", mode: "z", half: 1, startSec: 42, endSec: 52, durationSec: 10, startedAtVideoSec: 42, endedAtVideoSec: 52, createdAt: 4 },
    { id: "s5", type: "opponent", mode: "x", half: 2, startSec: 0, endSec: 20, durationSec: 20, startedAtVideoSec: 0, endedAtVideoSec: 20, createdAt: 5 },
  ],
};

const blocks = buildPossessionLivePlayBlocks([source]);

assert.equal(blocks.length, 3);
assert.deepEqual(
  blocks.map((block) => block.durationSec),
  [31, 20, 10],
);
assert.equal(blocks[0].teamSegments, 1);
assert.equal(blocks[0].opponentSegments, 1);

const summary = summarizePossessionLivePlayBlocks(blocks);
assert.equal(summary.count, 3);
assert.equal(summary.totalDuration, 61);
assert.equal(summary.medianDuration, 20);
assert.equal(summary.p75Duration, 31);
assert.equal(summary.p90Duration, 31);

const buckets = buildPossessionLivePlayBuckets(blocks);
assert.equal(buckets.find((bucket) => bucket.name === "0-15 s")?.blocks, 1);
assert.equal(buckets.find((bucket) => bucket.name === "15-30 s")?.blocks, 1);
assert.equal(buckets.find((bucket) => bucket.name === "30-45 s")?.blocks, 1);

const chartRows = buildPossessionLivePlayBucketChartRows(blocks);
const sumPct = chartRows.reduce((sum, row) => sum + row.pctOfBlocks, 0);
assert.ok(Math.abs(sumPct - 100) < 1e-9);
assert.ok(Math.abs((chartRows.find((row) => row.name === "0-15 s")?.pctOfBlocks ?? 0) - 100 / 3) < 1e-9);

console.log("possessionLivePlay tests: OK");
