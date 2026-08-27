import assert from "node:assert/strict";
import {
  ATTACK_LINE_PLAYERS_COUNT_OPTIONS,
  getShotLinePlayersCount,
  isCleanShot,
  isShotGoal,
  summarizeCleanShots,
  toggleAttackLinePlayersCount,
} from "./shotLinePlayers";
import { Shot } from "../types";

const attackClean: Shot = {
  id: "a1",
  x: 50,
  y: 50,
  minute: 1,
  xG: 0.4,
  isGoal: false,
  matchId: "m",
  timestamp: 1,
  shotType: "on_target",
  teamContext: "attack",
  teamId: "t1",
  linePlayersCount: 0,
};

const attackBlocked: Shot = {
  ...attackClean,
  id: "a2",
  linePlayersCount: 2,
  xG: 0.2,
};

const defenseClean: Shot = {
  ...attackClean,
  id: "d1",
  teamContext: "defense",
  linePlayers: [],
  linePlayersCount: undefined,
};

const defenseWithLine: Shot = {
  ...defenseClean,
  id: "d2",
  linePlayers: ["p1", "p2"],
};

assert.deepEqual([...ATTACK_LINE_PLAYERS_COUNT_OPTIONS], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
assert.equal(toggleAttackLinePlayersCount(0, 3), 3);
assert.equal(toggleAttackLinePlayersCount(3, 3), 0);
assert.equal(toggleAttackLinePlayersCount(3, 7), 7);
assert.equal(toggleAttackLinePlayersCount(2, 0), 2);
assert.equal(toggleAttackLinePlayersCount(2, 11), 2);

assert.equal(getShotLinePlayersCount(attackClean), 0);
assert.equal(getShotLinePlayersCount(attackBlocked), 2);
assert.equal(getShotLinePlayersCount(defenseClean), 0);
assert.equal(getShotLinePlayersCount(defenseWithLine), 2);

assert.equal(isCleanShot(attackClean), true);
assert.equal(isCleanShot(attackBlocked), false);
assert.equal(isCleanShot(defenseClean), true);
assert.equal(isCleanShot(defenseWithLine), false);

const goalShot: Shot = { ...attackClean, id: "g1", isGoal: true, shotType: "goal" };
assert.equal(isShotGoal(goalShot), true);
assert.equal(isShotGoal(attackClean), false);

const summary = summarizeCleanShots([attackClean, attackBlocked, defenseClean, goalShot]);
assert.equal(summary.shots, 3);
assert.ok(Math.abs(summary.xg - 1.2) < 1e-9);
assert.equal(summary.goals, 1);

console.log("shotLinePlayers tests: OK");
