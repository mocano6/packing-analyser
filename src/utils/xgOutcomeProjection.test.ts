import assert from "node:assert/strict";
import { calculateXgOutcomeProjection } from "./xgOutcomeProjection";

const emptyProjection = calculateXgOutcomeProjection([], []);
assert.equal(emptyProjection.winProbability, 0);
assert.equal(emptyProjection.drawProbability, 1);
assert.equal(emptyProjection.lossProbability, 0);
assert.equal(emptyProjection.expectedPoints, 1);
assert.equal(emptyProjection.opponentExpectedPoints, 1);

const certainWinProjection = calculateXgOutcomeProjection([{ xG: 1 }], []);
assert.equal(certainWinProjection.winProbability, 1);
assert.equal(certainWinProjection.drawProbability, 0);
assert.equal(certainWinProjection.lossProbability, 0);
assert.equal(certainWinProjection.expectedPoints, 3);
assert.equal(certainWinProjection.opponentExpectedPoints, 0);

const balancedProjection = calculateXgOutcomeProjection([{ xG: 0.5 }], [{ xG: 0.5 }]);
assert.equal(balancedProjection.winProbability, 0.25);
assert.equal(balancedProjection.drawProbability, 0.5);
assert.equal(balancedProjection.lossProbability, 0.25);
assert.equal(balancedProjection.expectedPoints, 1.25);
assert.equal(balancedProjection.opponentExpectedPoints, 1.25);

const clampedProjection = calculateXgOutcomeProjection([{ xG: 2 }], [{ xG: -1 }, { xG: null }]);
assert.equal(clampedProjection.winProbability, 1);
assert.equal(clampedProjection.expectedPoints, 3);
