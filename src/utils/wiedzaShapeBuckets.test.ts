import assert from "assert";
import {
  bucketMetaForWiedzaShape,
  summarizeRegainShapeBuckets,
  summarizeLoseShapeBuckets,
} from "./wiedzaShapeBuckets";

assert.deepStrictEqual(bucketMetaForWiedzaShape(5, 4, 1, "diff"), {
  key: "1to2",
  label: "Od +1 do +2",
  sortOrder: 4,
});

const regainRows = [
  {
    partners: 5,
    opponents: 4,
    diff: 1,
    pxt: 2,
    xg: 0.1,
    pk: 1,
    xtDelta: 0.2,
    packingPoints: 4,
    hasLose: false,
  },
  {
    partners: 6,
    opponents: 5,
    diff: 1,
    pxt: 0,
    xg: 0.2,
    pk: 0,
    xtDelta: 0,
    packingPoints: 0,
    hasLose: true,
  },
];

const byDiff = summarizeRegainShapeBuckets(regainRows, "diff");
assert.strictEqual(byDiff.length, 1);
assert.strictEqual(byDiff[0].n, 2);
assert.strictEqual(byDiff[0].avgPxt, 1);
assert.ok(Math.abs(byDiff[0].avgXg - 0.15) < 1e-9);
assert.strictEqual(byDiff[0].avgPk, 0.5);
assert.strictEqual(byDiff[0].avgXtDelta, 0.1);
assert.strictEqual(byDiff[0].avgPackingPts, 2);
assert.strictEqual(byDiff[0].losePct, 50);

const byPartners = summarizeRegainShapeBuckets(regainRows, "partners");
assert.ok(byPartners.some((b) => b.key === "5-6" && b.n === 2));

const loseRows = [
  { partners: 3, opponents: 5, diff: -2, opponentXg: 0.5, opponentPk: 1, hasOpponentLose: true },
  { partners: 3, opponents: 5, diff: -2, opponentXg: 0.5, opponentPk: 0, hasOpponentLose: false },
];
const loseSum = summarizeLoseShapeBuckets(loseRows, "diff");
assert.strictEqual(loseSum[0].n, 2);
assert.strictEqual(loseSum[0].avgOpponentXg, 0.5);
assert.strictEqual(loseSum[0].regainPct, 50);

console.log("wiedzaShapeBuckets tests: OK");
