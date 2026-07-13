import assert from "node:assert/strict";
import type { Action } from "@/types";
import {
  filterRegainActionsForTab,
  isOwnHalfByZoneColumn,
  matchesRegainLosesPFilter,
  regainMapZoneName,
  toggleRegainLosesPFilter,
} from "./statystykiZespoluRegainLosesFilters";

function action(overrides: Partial<Action> = {}): Action {
  return {
    id: "a1",
    matchId: "m1",
    teamId: "t1",
    minute: 12,
    actionType: "regain",
    senderId: "p1",
    isSecondHalf: false,
    regainAttackZone: "C5",
    ...overrides,
  };
}

assert.equal(isOwnHalfByZoneColumn("A6"), true);
assert.equal(isOwnHalfByZoneColumn("D8"), false);
assert.equal(regainMapZoneName(action()), "C5");
assert.equal(filterRegainActionsForTab([action(), action({ regainAttackZone: "H12" })], "own", []).length, 1);
assert.equal(matchesRegainLosesPFilter(action({ isP2: true }), ["p2"]), true);
assert.deepEqual(toggleRegainLosesPFilter(["p0"], "p1"), ["p1"]);
assert.deepEqual(toggleRegainLosesPFilter(["p1"], "p1"), []);

console.log("statystykiZespoluRegainLosesFilters.test.ts: OK");
