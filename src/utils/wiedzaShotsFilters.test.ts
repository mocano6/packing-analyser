import assert from "node:assert/strict";
import {
  DEFAULT_WIEDZA_SHOTS_FILTERS,
  filterShotsForWiedzaTab,
  withWiedzaShotActionCategory,
} from "./wiedzaShotsFilters";
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

(function testActionCategorySingleSelect() {
  const shots = [
    makeShot({ id: "a", actionType: "open_play" }),
    makeShot({ id: "b", actionType: "counter" }),
    makeShot({ id: "c", actionType: "corner" }),
  ];
  const counterOnly = filterShotsForWiedzaTab(shots, {
    ...DEFAULT_WIEDZA_SHOTS_FILTERS,
    actionCategory: "counter",
  });
  assert.equal(counterOnly.length, 1);
  assert.equal(counterOnly[0].id, "b");
})();

(function testSfgAndGoalCombined() {
  const shots = [
    makeShot({ id: "g1", actionType: "corner", shotType: "goal", isGoal: true }),
    makeShot({ id: "g2", actionType: "corner", shotType: "off_target" }),
    makeShot({ id: "g3", actionType: "open_play", shotType: "goal", isGoal: true }),
  ];
  const sfgGoals = filterShotsForWiedzaTab(shots, {
    ...DEFAULT_WIEDZA_SHOTS_FILTERS,
    actionCategory: "sfg",
    outcome: "goal",
  });
  assert.equal(sfgGoals.length, 1);
  assert.equal(sfgGoals[0].id, "g1");
})();

(function testSfgSubfiltersAndPhase() {
  const shots = [
    makeShot({ id: "c1", actionType: "corner", sfgSubtype: "direct", actionPhase: "phase1" }),
    makeShot({ id: "c2", actionType: "corner", sfgSubtype: "combination", actionPhase: "phase2" }),
    makeShot({ id: "p1", actionType: "penalty" }),
  ];
  const phase1 = filterShotsForWiedzaTab(shots, {
    ...DEFAULT_WIEDZA_SHOTS_FILTERS,
    actionCategory: "sfg",
    sfgPhase: "phase1",
  });
  assert.equal(phase1.length, 1);
  assert.equal(phase1[0].id, "c1");

  const directCorners = filterShotsForWiedzaTab(shots, {
    ...DEFAULT_WIEDZA_SHOTS_FILTERS,
    actionCategory: "sfg",
    sfgType: "corner",
    sfgSubtype: "direct",
  });
  assert.equal(directCorners.length, 1);
  assert.equal(directCorners[0].id, "c1");
})();

(function testWithActionCategoryResetsSfg() {
  const next = withWiedzaShotActionCategory(
    {
      ...DEFAULT_WIEDZA_SHOTS_FILTERS,
      actionCategory: "sfg",
      sfgType: "corner",
      sfgSubtype: "direct",
      sfgPhase: "phase1",
    },
    "counter",
  );
  assert.equal(next.actionCategory, "counter");
  assert.equal(next.outcome, "all");
  assert.equal(next.sfgType, "all");
  assert.equal(next.sfgSubtype, "all");
  assert.equal(next.sfgPhase, "all");
})();

console.log("wiedzaShotsFilters tests: OK");
