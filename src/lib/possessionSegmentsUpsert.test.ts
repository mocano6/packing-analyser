import assert from "assert";
import type { PossessionSegment } from "@/types";
import { sanitizePossessionSegments, upsertPossessionSegments } from "./possessionSegmentsUpsert";

const seg = (
  startSec: number,
  endSec: number,
  type: PossessionSegment["type"],
  mode: PossessionSegment["mode"],
  half: 1 | 2 = 1
): PossessionSegment => ({
  id: `t_${startSec}_${endSec}`,
  type,
  mode,
  half,
  startSec,
  endSec,
  durationSec: endSec - startSec,
  startedAtVideoSec: startSec,
  endedAtVideoSec: endSec,
  createdAt: 1,
});

assert.deepStrictEqual(sanitizePossessionSegments(null), []);

const merged = upsertPossessionSegments([seg(0, 10, "team", "z")], [seg(5, 15, "opponent", "c")]);
assert.strictEqual(merged.length, 2);
assert.strictEqual(merged[0].startSec, 0);
assert.strictEqual(merged[0].endSec, 5);
assert.strictEqual(merged[1].startSec, 5);
assert.strictEqual(merged[1].endSec, 15);

const stitched = upsertPossessionSegments([], [
  seg(0, 5, "team", "z"),
  seg(5, 10, "team", "z"),
]);
assert.strictEqual(stitched.length, 1);
assert.strictEqual(stitched[0].endSec, 10);

console.log("possessionSegmentsUpsert.test: OK");
