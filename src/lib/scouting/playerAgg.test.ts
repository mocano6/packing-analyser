import assert from 'node:assert/strict';
import {
  accumulatePlayerMatchStat,
  emptyPlayerMatchAgg,
  formatPlayerCards,
} from './playerAgg';

const base = emptyPlayerMatchAgg();

assert.deepEqual(
  accumulatePlayerMatchStat(base, {
    minutesPlayed: 90,
    goals: 1,
    isStarter: true,
    yellowCards: 1,
    redCards: 0,
  }),
  { minutes: 90, goals: 1, matches: 1, starts: 1, subs: 0, yellowCards: 1, redCards: 0 }
);

assert.deepEqual(
  accumulatePlayerMatchStat(
    { minutes: 90, goals: 1, matches: 1, starts: 1, subs: 0, yellowCards: 1, redCards: 0 },
    { minutesPlayed: 25, goals: 0, isStarter: false, yellowCards: 0, redCards: 1 }
  ),
  { minutes: 115, goals: 1, matches: 2, starts: 1, subs: 1, yellowCards: 1, redCards: 1 }
);

assert.deepEqual(
  accumulatePlayerMatchStat(base, {
    minutesPlayed: 0,
    goals: 0,
    isStarter: false,
    yellowCards: 0,
    redCards: 0,
  }),
  base
);

assert.equal(formatPlayerCards(0, 0), '');
assert.equal(formatPlayerCards(2, 1), '2🟨 1🟥');

console.log('playerAgg.test.ts: OK');
