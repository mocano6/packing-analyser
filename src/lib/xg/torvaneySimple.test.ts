import assert from "assert";
import {
  getTorvaneySimpleXGProbability,
  getTorvaneySimpleXGPercentRounded,
  percentToTorvaneyPixels,
} from "./torvaneySimple";

const centerWidthSx = 195;
const goalLineSy = 5;
const halfPitchSy = 285;
const pitchLengthM = 105;
const pitchWidthM = 68;

function xPercentFromDistanceToRightGoal(distanceMeters: number): number {
  return ((pitchLengthM - distanceMeters) / pitchLengthM) * 100;
}

function xPercentFromDistanceToLeftGoal(distanceMeters: number): number {
  return (distanceMeters / pitchLengthM) * 100;
}

function yPercentFromTopTouchlineDistance(distanceMeters: number): number {
  return (distanceMeters / pitchWidthM) * 100;
}

void (function testTorvaneyPixelsMapping() {
  const { sx, sy } = percentToTorvaneyPixels(50, 50, "attack");
  assert(Math.abs(sx - centerWidthSx) < 1, `sx attack: ${sx}`);
  assert(Math.abs(sy - halfPitchSy) < 1, `sy attack: ${sy}`);
  const d = percentToTorvaneyPixels(50, 50, "defense");
  assert(Math.abs(d.sx - centerWidthSx) < 1, `sx defense: ${d.sx}`);
  assert(Math.abs(d.sy - halfPitchSy) < 1, `sy defense: ${d.sy}`);
})();

void (function testTorvaneyGeometryAnchors() {
  const penaltyAreaTopY = yPercentFromTopTouchlineDistance((pitchWidthM - 40.32) / 2);
  const goalAreaTopY = yPercentFromTopTouchlineDistance((pitchWidthM - 18.32) / 2);

  const rightPenaltyCorner = percentToTorvaneyPixels(
    xPercentFromDistanceToRightGoal(16.5),
    penaltyAreaTopY,
    "attack"
  );
  assert(Math.abs(rightPenaltyCorner.sx - 85) < 0.1, `penalty corner sx: ${rightPenaltyCorner.sx}`);
  assert(Math.abs(rightPenaltyCorner.sy - 100) < 0.1, `penalty corner sy: ${rightPenaltyCorner.sy}`);

  const rightGoalAreaCorner = percentToTorvaneyPixels(
    xPercentFromDistanceToRightGoal(5.5),
    goalAreaTopY,
    "attack"
  );
  assert(Math.abs(rightGoalAreaCorner.sx - 140) < 0.1, `goal area corner sx: ${rightGoalAreaCorner.sx}`);
  assert(Math.abs(rightGoalAreaCorner.sy - 37.5) < 0.1, `goal area corner sy: ${rightGoalAreaCorner.sy}`);

  const leftPenaltyCorner = percentToTorvaneyPixels(
    xPercentFromDistanceToLeftGoal(16.5),
    penaltyAreaTopY,
    "defense"
  );
  assert.deepStrictEqual(
    {
      sx: Number(leftPenaltyCorner.sx.toFixed(2)),
      sy: Number(leftPenaltyCorner.sy.toFixed(2)),
    },
    {
      sx: Number(rightPenaltyCorner.sx.toFixed(2)),
      sy: Number(rightPenaltyCorner.sy.toFixed(2)),
    }
  );
})();

void (function testTorvaneyReferenceLineValues() {
  const penaltyLineCenter = getTorvaneySimpleXGPercentRounded(
    xPercentFromDistanceToRightGoal(16.5),
    50,
    { isHeader: false, teamContext: "attack" }
  );
  assert.strictEqual(penaltyLineCenter, 14);

  const goalAreaLineCenter = getTorvaneySimpleXGPercentRounded(
    xPercentFromDistanceToRightGoal(5.5),
    50,
    { isHeader: false, teamContext: "attack" }
  );
  assert.strictEqual(goalAreaLineCenter, 58);
})();

void (function testGoalMouthAttack() {
  const p = getTorvaneySimpleXGProbability(centerWidthSx, goalLineSy, false);
  assert(p > 0 && p < 1, `probability range: ${p}`);
  const pct = getTorvaneySimpleXGPercentRounded(100, 50, {
    isHeader: false,
    teamContext: "attack",
  });
  assert(pct >= 0 && pct <= 100, `percent: ${pct}`);
})();

void (function testHeaderChangesValue() {
  const x = 85;
  const y = 50;
  const foot = getTorvaneySimpleXGPercentRounded(x, y, {
    isHeader: false,
    teamContext: "attack",
  });
  const head = getTorvaneySimpleXGPercentRounded(x, y, {
    isHeader: true,
    teamContext: "attack",
  });
  assert(foot !== head, `head should differ from foot: ${foot} vs ${head}`);
})();

void (function testOffPitchZero() {
  const p = getTorvaneySimpleXGProbability(2, 2, false);
  assert.strictEqual(p, 0);
})();

console.log("torvaneySimple tests: OK");
