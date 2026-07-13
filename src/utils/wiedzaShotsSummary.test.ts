import assert from "node:assert/strict";
import {
  buildWiedzaShotsSummary,
  classifyWiedzaShotActionCategory,
  classifyWiedzaXgBucket,
} from "./wiedzaShotsSummary";
import { Shot } from "@/types";

function makeShot(overrides: Partial<Shot> = {}): Shot {
  return {
    id: "s1",
    x: 80,
    y: 50,
    minute: 10,
    xG: 0.2,
    isGoal: false,
    shotType: "off_target",
    teamContext: "attack",
    teamId: "team-a",
    matchId: "m1",
    timestamp: 1,
    ...overrides,
  };
}

(function testClassifyActionCategory() {
  assert.equal(classifyWiedzaShotActionCategory(makeShot({ actionType: "corner" })), "sfg");
  assert.equal(classifyWiedzaShotActionCategory(makeShot({ actionType: "counter" })), "counter");
  assert.equal(classifyWiedzaShotActionCategory(makeShot({ actionType: "regain" })), "regain");
  assert.equal(classifyWiedzaShotActionCategory(makeShot({ actionType: "open_play" })), "open_play");
})();

(function testXgBuckets() {
  assert.equal(classifyWiedzaXgBucket(0.02), "0-0.05");
  assert.equal(classifyWiedzaXgBucket(0.08), "0.05-0.1");
  assert.equal(classifyWiedzaXgBucket(0.15), "0.1-0.2");
  assert.equal(classifyWiedzaXgBucket(0.25), "0.2-0.35");
  assert.equal(classifyWiedzaXgBucket(0.5), "0.35+");
})();

(function testBuildSummary() {
  const summary = buildWiedzaShotsSummary([
    makeShot({ id: "a", actionType: "open_play", xG: 0.1, shotType: "on_target" }),
    makeShot({ id: "b", actionType: "corner", xG: 0.4, shotType: "goal", isGoal: true }),
    makeShot({ id: "c", actionType: "counter", xG: 0.05, shotType: "blocked" }),
  ]);

  assert.equal(summary.totalShots, 3);
  assert.equal(summary.goals, 1);
  assert.ok(Math.abs(summary.totalXg - 0.55) < 1e-9);
  assert.equal(summary.byActionCategory.length, 3);
  assert.equal(summary.byShotType.length, 3);
  assert.ok(summary.byActionCategory.some((row) => row.key === "sfg" && row.count === 1));
  assert.ok(summary.byXgBucket.some((row) => row.key === "0.35+" && row.count === 1));
})();

console.log("wiedzaShotsSummary tests: OK");
