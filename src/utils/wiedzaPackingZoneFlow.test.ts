import assert from "node:assert/strict";
import type { Action, TeamInfo } from "../types";
import {
  buildWiedzaPackingFlowFromMatches,
  edgeKey,
  isAttackPackingForMatchTeam,
  metricFromBucket,
  packingActionMetrics,
  packingContactKind,
  packingStartEndZones,
} from "./wiedzaPackingZoneFlow";

const baseAction = (over: Partial<Action>): Action =>
  ({
    id: "a1",
    matchId: "m1",
    teamId: "t1",
    senderId: "s1",
    minute: 1,
    isSecondHalf: false,
    actionType: "pass",
    ...over,
  }) as Action;

assert.equal(isAttackPackingForMatchTeam(baseAction({ mode: "defense" }), "t1"), false);
assert.equal(isAttackPackingForMatchTeam(baseAction({ mode: "attack" }), "t1"), true);
assert.equal(isAttackPackingForMatchTeam(baseAction({}), "t1"), true);
assert.equal(isAttackPackingForMatchTeam(baseAction({ teamId: "other" }), "t1"), false);

const mets = packingActionMetrics(
  baseAction({ xTValueStart: 0.1, xTValueEnd: 0.2, packingPoints: 2 }),
);
assert.ok(Math.abs(mets.pxt - 0.2) < 1e-9);
assert.ok(Math.abs(mets.xtDelta - 0.1) < 1e-9);
assert.equal(mets.packPts, 2);

assert.equal(packingContactKind(baseAction({ isContact1: true })), "c1");
assert.equal(packingContactKind(baseAction({ isContact2: true })), "c2");
assert.equal(packingContactKind(baseAction({ isContact3Plus: true, isContact2: true })), "c3");

assert.deepEqual(packingStartEndZones(baseAction({ startZone: "a1", endZone: "b2" })), { start: "A1", end: "B2" });
assert.equal(packingStartEndZones(baseAction({ startZone: "a1" })), null);
// Pusty endZone nie może blokować toZone (?? zwraca "" zamiast fallbacku)
assert.deepEqual(
  packingStartEndZones(
    baseAction({ startZone: "c1", endZone: "", toZone: "d2" }),
  ),
  { start: "C1", end: "D2" },
);
assert.deepEqual(
  packingStartEndZones(
    baseAction({ startZone: "", fromZone: "e3", endZone: "f4" }),
  ),
  { start: "E3", end: "F4" },
);

const match: TeamInfo & { id: string } = {
  id: "m1",
  team: "t1",
  opponent: "o",
  date: "2026-01-01",
  isHome: true,
  competition: "L",
  actions_packing: [
    baseAction({
      id: "x1",
      startZone: "C1",
      endZone: "C2",
      xTValueStart: 0,
      xTValueEnd: 0.1,
      packingPoints: 1,
      isContact1: true,
    }),
    baseAction({
      id: "x2",
      startZone: "C1",
      endZone: "C2",
      xTValueStart: 0,
      xTValueEnd: 0.2,
      packingPoints: 2,
      isContact2: true,
    }),
    baseAction({
      id: "x3",
      mode: "defense",
      startZone: "C1",
      endZone: "C2",
      isContact1: true,
    }),
  ],
};

const flow = buildWiedzaPackingFlowFromMatches([match]);
assert.equal(flow.totalActions, 2);
assert.equal(flow.actionsWithZonePair, 2);
assert.equal(flow.contactBuckets.c1.n, 1);
assert.equal(flow.contactBuckets.c2.n, 1);
assert.equal(flow.edgeByKey.get(edgeKey("C1", "C2"))?.n, 2);
const edge = flow.edgeByKey.get(edgeKey("C1", "C2"));
assert.ok(edge);
if (edge) {
  assert.ok(Math.abs(metricFromBucket({ n: edge.n, sumPxt: edge.sumPxt, sumXtDelta: edge.sumXtDelta, sumPackPts: edge.sumPackPts }, "pxt") - edge.sumPxt) < 1e-9);
}

console.log("wiedzaPackingZoneFlow tests: OK");
