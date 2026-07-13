import assert from "node:assert/strict";
import { PKEntry } from "@/types";
import {
  buildWiedzaPkEntriesSummary,
  classifyWiedzaPkEntryType,
  classifyWiedzaPkOutcome,
} from "./wiedzaPkEntriesSummary";

function makeEntry(overrides: Partial<PKEntry> = {}): PKEntry {
  return {
    id: "pk1",
    matchId: "m1",
    teamId: "t1",
    startX: 70,
    startY: 50,
    endX: 85,
    endY: 50,
    minute: 12,
    isSecondHalf: false,
    entryType: "pass",
    teamContext: "attack",
    timestamp: 1,
    ...overrides,
  };
}

(function testClassify() {
  assert.equal(classifyWiedzaPkEntryType(makeEntry({ entryType: "dribble" })), "dribble");
  assert.equal(classifyWiedzaPkEntryType(makeEntry({ entryType: "sfg" })), "sfg");
  assert.equal(classifyWiedzaPkOutcome(makeEntry({ isGoal: true })), "goal");
  assert.equal(classifyWiedzaPkOutcome(makeEntry({ isShot: true })), "shot");
  assert.equal(classifyWiedzaPkOutcome(makeEntry({ isRegain: true })), "regain");
})();

(function testBuildSummary() {
  const summary = buildWiedzaPkEntriesSummary([
    makeEntry({ id: "a", isShot: true, pkPlayersCount: 2, opponentsInPKCount: 4 }),
    makeEntry({ id: "b", entryType: "sfg", isGoal: true, isShot: true }),
    makeEntry({ id: "c", isRegain: true }),
  ]);

  assert.equal(summary.totalEntries, 3);
  assert.equal(summary.shots, 2);
  assert.equal(summary.goals, 1);
  assert.equal(summary.regains, 1);
  assert.ok(summary.byEntryType.length >= 2);
  assert.ok(summary.byOutcome.some((r) => r.key === "goal"));
})();
