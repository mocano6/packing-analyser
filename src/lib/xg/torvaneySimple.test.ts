import assert from "assert";
import {
  getTorvaneySimpleXGProbability,
  getTorvaneySimpleXGPercentRounded,
  percentToTorvaneyPixels,
} from "./torvaneySimple";

// Punkt odniesienia: środek boiska w pikselach Torvaney (~195, 145) — wartość stabilna przy refaktorze.
const centerSx = 195;
const centerSy = 145;

void (function testTorvaneyPixelsMapping() {
  const { sx, sy } = percentToTorvaneyPixels(50, 50, "attack");
  assert(Math.abs(sx - centerSx) < 1, `sx attack: ${sx}`);
  assert(Math.abs(sy - 145) < 1, `sy attack: ${sy}`);
  const d = percentToTorvaneyPixels(50, 50, "defense");
  assert(Math.abs(d.sx - centerSx) < 1, `sx defense: ${d.sx}`);
  assert(Math.abs(d.sy - 145) < 1, `sy defense: ${d.sy}`);
})();

void (function testGoalMouthAttack() {
  const p = getTorvaneySimpleXGProbability(centerSx, 5, false);
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
