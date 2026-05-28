import assert from "assert";
import {
  buildZoneRectFromStorage,
  clampPlayerStoragePercent,
  clientPointToStoragePercent,
  SET_PIECE_HALF_PITCH_MIN_STORAGE_X,
  viewportPercentToStorage,
} from "./setPiecePitchCoords";

function testViewportToStorageMapsRightHalf() {
  assert.deepStrictEqual(viewportPercentToStorage(0, 50), { x: 50, y: 50 });
  assert.deepStrictEqual(viewportPercentToStorage(100, 0), { x: 100, y: 0 });
}

function testClientPointUsesViewportRect() {
  const rect = { left: 100, top: 200, width: 400, height: 200 } as DOMRect;
  const point = clientPointToStoragePercent(300, 300, rect);
  assert.strictEqual(point.x, 75);
  assert.strictEqual(point.y, 50);
}

function testClampPlayerReachesCenterAndGoalLines() {
  const center = clampPlayerStoragePercent(50, 0);
  const goal = clampPlayerStoragePercent(100, 100);
  assert.strictEqual(center.x, 50);
  assert.strictEqual(center.y, 0);
  assert.strictEqual(goal.x, 100);
  assert.strictEqual(goal.y, 100);
}

function testZoneRectClampsToAttackingHalf() {
  const zone = buildZoneRectFromStorage(40, 10, 80, 30);
  assert.strictEqual(zone.x, SET_PIECE_HALF_PITCH_MIN_STORAGE_X);
  assert.ok(zone.width > 0);
}

testViewportToStorageMapsRightHalf();
testClientPointUsesViewportRect();
testClampPlayerReachesCenterAndGoalLines();
testZoneRectClampsToAttackingHalf();

console.log("setPiecePitchCoords.test.ts — OK");
