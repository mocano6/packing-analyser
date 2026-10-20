import assert from "node:assert/strict";
import { buildMeanAbsShapPreview, maxShapFeaturesForSample } from "./wiedzaMeanAbsShap";

assert.equal(maxShapFeaturesForSample(22), 10);
assert.equal(maxShapFeaturesForSample(6), 2);

const n = 40;
const x1 = Array.from({ length: n }, (_, i) => i + 1);
const x2 = Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 1 : -1) * (i + 3));
const noise = Array.from({ length: n }, (_, i) => Math.sin(i * 1.7));
const constant = Array.from({ length: n }, () => 5);
const y = x1.map((value, i) => 4 * value - 2 * x2[i]);

const model = buildMeanAbsShapPreview("y", y, [
  { id: "x1", values: x1 },
  { id: "x2", values: x2 },
  { id: "noise", values: noise },
  { id: "constant", values: constant },
  { id: "y", values: y },
]);

assert.ok(model);
assert.equal(model!.targetId, "y");
assert.equal(model!.n, n);
assert.ok(model!.r2 > 0.95, `oczekiwane wysokie R², jest ${model!.r2}`);
assert.equal(model!.rows.some((row) => row.id === "constant"), false);
assert.equal(model!.rows.some((row) => row.id === "y"), false);

const row1 = model!.rows.find((row) => row.id === "x1");
const row2 = model!.rows.find((row) => row.id === "x2");
const rowNoise = model!.rows.find((row) => row.id === "noise");
assert.ok(row1 && row2);
assert.equal(row1!.direction, 1);
assert.equal(row2!.direction, -1);
assert.ok(row1!.meanAbsShap > (rowNoise?.meanAbsShap ?? 0));
assert.ok(row2!.meanAbsShap > (rowNoise?.meanAbsShap ?? 0));

assert.equal(buildMeanAbsShapPreview("y", [1, 1, 1, 1, 1, 1], [{ id: "x", values: [1, 2, 3, 4, 5, 6] }]), null);
assert.equal(
  buildMeanAbsShapPreview("y", [1, 2, 3], [{ id: "x", values: [1, 2, 3] }]),
  null,
);

console.log("wiedzaMeanAbsShap tests: OK");
