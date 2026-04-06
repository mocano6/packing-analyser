import assert from "node:assert/strict";
import { Action } from "@/types";
import { normalizeActionFieldCountsForSave } from "./normalizeActionFieldCountsForSave";

const base = {
  id: "1",
  matchId: "m",
  teamId: "t",
  senderId: "s",
  minute: 1,
  actionType: "pass" as const,
};

const a1: Action = {
  ...base,
  totalPlayersOnField: 9,
} as Action;

const out1 = normalizeActionFieldCountsForSave(a1);
assert.equal(out1.playersLeftField, 2);
assert.equal(out1.totalPlayersOnField, 9);

const a2: Action = {
  ...base,
  playersLeftField: 1,
  totalPlayersOnField: 10,
} as Action;

const out2 = normalizeActionFieldCountsForSave(a2);
assert.equal(out2.playersLeftField, 1);
assert.equal(out2.totalPlayersOnField, 10);

const a3: Action = {
  ...base,
  totalOpponentsOnField: 8,
} as Action;

const out3 = normalizeActionFieldCountsForSave(a3);
assert.equal(out3.opponentsLeftField, 3);
assert.equal(out3.totalOpponentsOnField, 8);

console.log("normalizeActionFieldCountsForSave tests: OK");
