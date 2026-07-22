import assert from "node:assert/strict";
import type { Action } from "@/types";
import {
  buildPxtAttackChannelStats,
  getPackingEndZone,
} from "./statystykiZespoluPxtAttackChannels";

function makeAction(overrides: Partial<Action> = {}): Action {
  return {
    id: "a1",
    matchId: "m1",
    minute: 10,
    actionType: "pass",
    packingPoints: 2,
    xTValueStart: 0.01,
    xTValueEnd: 0.05,
    senderId: "p1",
    receiverId: "p2",
    teamId: "team-a",
    fromZone: "C5",
    toZone: "D6",
    ...overrides,
  } as Action;
}

assert.equal(getPackingEndZone(makeAction()), "D6");
assert.equal(
  getPackingEndZone(makeAction({ toZone: undefined, endZone: "E8", fromZone: "A1" })),
  "E8",
);
assert.equal(
  getPackingEndZone(
    makeAction({
      actionType: "dribble",
      toZone: "B3",
      fromZone: "A2",
      endZone: null,
    }),
  ),
  "B3",
);

const channels = buildPxtAttackChannelStats([
  makeAction({ id: "w1", toZone: "A4", packingPoints: 1, xTValueStart: 0, xTValueEnd: 0.1 }), // PxT 0.1
  makeAction({ id: "w2", toZone: "B5", packingPoints: 1, xTValueStart: 0, xTValueEnd: 0.1 }), // PxT 0.1 → AB
  makeAction({ id: "c1", toZone: "C6", packingPoints: 2, xTValueStart: 0, xTValueEnd: 0.1 }), // PxT 0.2 → C
  makeAction({
    id: "drib",
    actionType: "dribble",
    toZone: "H9",
    packingPoints: 1,
    xTValueStart: 0,
    xTValueEnd: 0.2,
  }), // PxT 0.2 → GH
]);

assert.equal(channels.length, 6);

const ab = channels.find((c) => c.id === "AB")!;
const c = channels.find((c) => c.id === "C")!;
const gh = channels.find((c) => c.id === "GH")!;
const d = channels.find((c) => c.id === "D")!;

assert.equal(ab.count, 2);
assert.equal(ab.pxt, 0.2);
assert.equal(c.count, 1);
assert.equal(c.pxt, 0.2);
assert.equal(gh.count, 1);
assert.equal(gh.pxt, 0.2);
assert.equal(d.count, 0);

// 4 akcje łącznie: AB 50% count, C 25%, GH 25%
assert.equal(Math.round(ab.countSharePct), 50);
assert.equal(Math.round(c.countSharePct), 25);
assert.equal(Math.round(gh.countSharePct), 25);

// total PxT = 0.6 → AB/C/GH po 0.2 = ~33% każdy
assert.equal(Math.round(ab.pxtSharePct), 33);
assert.equal(Math.round(c.pxtSharePct), 33);
assert.equal(Math.round(gh.pxtSharePct), 33);

const empty = buildPxtAttackChannelStats([]);
assert.ok(empty.every((ch) => ch.count === 0 && ch.countSharePct === 0 && ch.pxtSharePct === 0));

console.log("statystykiZespoluPxtAttackChannels.test.ts: OK");
