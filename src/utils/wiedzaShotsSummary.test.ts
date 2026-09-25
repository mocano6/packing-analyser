import assert from "node:assert/strict";
import {
  buildWiedzaShotsSummary,
  classifyWiedzaShotActionCategory,
  classifyWiedzaShotZone1T,
  classifyWiedzaXgBucket,
  isWiedzaShotIn1TZone,
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
  assert.equal(summary.shots1T, 0);
  assert.equal(summary.shots1TPct, 0);
})();

(function testZone1TClassification() {
  assert.equal(isWiedzaShotIn1TZone(makeShot({ x: 95, y: 50, teamContext: "attack" })), true);
  assert.equal(isWiedzaShotIn1TZone(makeShot({ x: 80, y: 50, teamContext: "attack" })), false);
  assert.equal(isWiedzaShotIn1TZone(makeShot({ x: 5, y: 50, teamContext: "defense" })), true);
  assert.equal(isWiedzaShotIn1TZone(makeShot({ x: 95, y: 50, teamContext: "defense" })), false);
  assert.equal(classifyWiedzaShotZone1T(makeShot({ x: 95, y: 50 })), "zone_1t");
  assert.equal(classifyWiedzaShotZone1T(makeShot({ x: 50, y: 50 })), "outside_1t");
})();

(function testZone1TSummary() {
  const summary = buildWiedzaShotsSummary([
    makeShot({ id: "in-att", x: 95, y: 50, teamContext: "attack", xG: 0.3 }),
    makeShot({ id: "out-att", x: 70, y: 50, teamContext: "attack", xG: 0.1 }),
    makeShot({ id: "in-def", x: 5, y: 50, teamContext: "defense", xG: 0.2 }),
    makeShot({ id: "out-def", x: 40, y: 50, teamContext: "defense", xG: 0.05 }),
  ]);

  assert.equal(summary.totalShots, 4);
  assert.equal(summary.shots1T, 2);
  assert.equal(summary.shots1TPct, 50);
  assert.ok(Math.abs(summary.xg1T - 0.5) < 1e-9);
  const zoneRow = summary.byZone1T.find((row) => row.key === "zone_1t");
  const outsideRow = summary.byZone1T.find((row) => row.key === "outside_1t");
  assert.equal(zoneRow?.count, 2);
  assert.equal(outsideRow?.count, 2);
  assert.equal(zoneRow?.pct, 50);
})();

console.log("wiedzaShotsSummary tests: OK");
