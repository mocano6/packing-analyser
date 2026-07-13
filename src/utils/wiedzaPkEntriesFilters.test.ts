import assert from "node:assert/strict";
import { PKEntry } from "@/types";
import {
  DEFAULT_WIEDZA_PK_ENTRIES_FILTERS,
  filterPkEntriesForWiedzaTab,
} from "./wiedzaPkEntriesFilters";

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

(function testDefaultPassesAll() {
  const entries = [
    makeEntry({ id: "a", entryType: "pass" }),
    makeEntry({ id: "b", entryType: "dribble" }),
  ];
  assert.equal(filterPkEntriesForWiedzaTab(entries, DEFAULT_WIEDZA_PK_ENTRIES_FILTERS).length, 2);
})();

(function testEntryTypeAndOutcomeAnd() {
  const entries = [
    makeEntry({ id: "a", entryType: "sfg", isGoal: true, isShot: true }),
    makeEntry({ id: "b", entryType: "pass", isShot: true }),
    makeEntry({ id: "c", entryType: "pass", isRegain: true }),
  ];
  const sfgGoals = filterPkEntriesForWiedzaTab(entries, {
    entryType: "sfg",
    outcome: "goal",
  });
  assert.deepEqual(sfgGoals.map((e) => e.id), ["a"]);

  const regainOnly = filterPkEntriesForWiedzaTab(entries, {
    entryType: "all",
    outcome: "regain",
  });
  assert.deepEqual(regainOnly.map((e) => e.id), ["c"]);
})();
