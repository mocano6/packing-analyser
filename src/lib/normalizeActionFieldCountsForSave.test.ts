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

{
  const r: Action = {
    ...base,
    regainDefenseZone: "G1",
    receptionBackAllyCount: 4,
  } as Action;
  const o = normalizeActionFieldCountsForSave(r);
  assert.equal(o.regainOppRosterSquadTallyF1, 4);
  assert.equal(o.receptionBackAllyCount, undefined);
}

{
  const l: Action = {
    ...base,
    isReaction5s: false,
    losesBackAllyCount: 2,
  } as Action;
  const o = normalizeActionFieldCountsForSave(l);
  assert.equal(o.losesOppRosterSquadTallyF1, 2);
  assert.equal(o.losesBackAllyCount, undefined);
}

console.log("normalizeActionFieldCountsForSave tests: OK");
