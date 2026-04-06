import assert from "node:assert/strict";
import type { TeamInfo } from "@/types";
import { findActionCollectionFieldInMatchData } from "./findActionCollectionField";

const base: TeamInfo = {
  team: "t",
  opponent: "o",
  isHome: true,
  competition: "c",
  date: "2024-01-01",
  actions_packing: [{ id: "p1", matchId: "m", teamId: "t", senderId: "s", minute: 1, actionType: "pass", packingPoints: 1 } as any],
  actions_unpacking: [{ id: "u1", matchId: "m", teamId: "t", senderId: "s", minute: 1, actionType: "pass", packingPoints: 1, mode: "defense" } as any],
  actions_regain: [{ id: "r1", matchId: "m", teamId: "t", senderId: "s", minute: 1, actionType: "pass", packingPoints: 0, playersBehindBall: 1 } as any],
  actions_loses: [{ id: "l1", matchId: "m", teamId: "t", senderId: "s", minute: 1, actionType: "pass", packingPoints: 0, isReaction5s: true } as any],
};

assert.equal(findActionCollectionFieldInMatchData(base, "p1"), "actions_packing");
assert.equal(findActionCollectionFieldInMatchData(base, "u1"), "actions_unpacking");
assert.equal(findActionCollectionFieldInMatchData(base, "r1"), "actions_regain");
assert.equal(findActionCollectionFieldInMatchData(base, "l1"), "actions_loses");
assert.equal(findActionCollectionFieldInMatchData(base, "missing"), null);

console.log("findActionCollectionField tests: OK");
