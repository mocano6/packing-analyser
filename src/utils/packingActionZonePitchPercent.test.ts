import assert from "node:assert/strict";
import {
  actionToPitchCoordinates,
  resolveZoneIndex,
  zoneIndexToPitchPercent,
} from "./packingActionZonePitchPercent";
import type { Action } from "@/types";

function baseAction(overrides: Partial<Action> = {}): Action {
  return {
    id: "a1",
    matchId: "m1",
    teamId: "t1",
    minute: 10,
    actionType: "pass",
    senderId: "p1",
    isSecondHalf: false,
    ...overrides,
  };
}

assert.equal(resolveZoneIndex("C5"), 2 * 12 + 4);
assert.equal(resolveZoneIndex(28), 28);

const c5Center = zoneIndexToPitchPercent(2 * 12 + 4);
assert.ok(Math.abs(c5Center.x - ((4 + 0.5) / 12) * 100) < 0.01);
assert.ok(Math.abs(c5Center.y - ((2 + 0.5) / 8) * 100) < 0.01);

const passCoords = actionToPitchCoordinates(
  baseAction({ fromZone: "A1", toZone: "C5" }),
);
assert.ok(passCoords);
assert.ok(passCoords.startY < passCoords.endY);

const dribbleCoords = actionToPitchCoordinates(
  baseAction({ actionType: "dribble", startZone: "B3", endZone: "B3" }),
);
assert.ok(dribbleCoords);
assert.equal(dribbleCoords.startX, dribbleCoords.endX);
assert.equal(dribbleCoords.startY, dribbleCoords.endY);

assert.equal(actionToPitchCoordinates(baseAction({})), null);

console.log("packingActionZonePitchPercent.test.ts: OK");
