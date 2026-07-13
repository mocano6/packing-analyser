import assert from "node:assert/strict";
import type { Action } from "@/types";
import {
  summarizeLosesBypassedOpponents,
  summarizeRegainBypassedOpponents,
} from "./statystykiZespoluRegainLosesBypassed";

function regain(overrides: Partial<Action> = {}): Action {
  return {
    id: "r1",
    matchId: "m1",
    teamId: "t1",
    minute: 10,
    actionType: "regain",
    senderId: "p1",
    isSecondHalf: false,
    ...overrides,
  };
}

function lose(overrides: Partial<Action> = {}): Action {
  return {
    id: "l1",
    matchId: "m1",
    teamId: "t1",
    minute: 10,
    actionType: "lose",
    senderId: "p1",
    isSecondHalf: false,
    ...overrides,
  };
}

const regainStats = summarizeRegainBypassedOpponents([
  regain({ regainOppRosterSquadTallyF1: 4 }),
  regain({ id: "r2", regainOppRosterSquadTallyF1: 2 }),
  regain({ id: "r3" }),
]);
assert.equal(regainStats.totalBypassed, 6);
assert.equal(regainStats.recordedCount, 2);
assert.equal(regainStats.avgBypassed, 3);

const losesStats = summarizeLosesBypassedOpponents([
  lose({ losesOppRosterSquadTallyF1: 5 }),
  lose({ id: "l2", losesBackAllyCount: 1 }),
  lose({ id: "l3", isAut: true, losesOppRosterSquadTallyF1: 0 }),
]);
assert.equal(losesStats.totalBypassed, 6);
assert.equal(losesStats.recordedCount, 3);
assert.equal(losesStats.avgBypassed, 2);

console.log("statystykiZespoluRegainLosesBypassed.test.ts: OK");
