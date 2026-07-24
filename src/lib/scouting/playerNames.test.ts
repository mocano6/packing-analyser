import assert from 'node:assert/strict';
import { resolvePlayerDisplayName, seedPlayerFromMatchStat } from './playerNames';

assert.equal(resolvePlayerDisplayName('abc', { id: 'abc', firstname: 'Jan', lastname: 'Kowalski', age: 25, fetchedAt: '' }), 'Jan Kowalski');
assert.equal(resolvePlayerDisplayName('abc', null, { firstname: 'Adam', lastname: 'Nowak' }), 'Adam Nowak');
assert.equal(resolvePlayerDisplayName('abc', { id: 'abc', firstname: '', lastname: '', age: null, fetchedAt: '' }, { firstname: 'Erik', lastname: 'Jirka' }), 'Erik Jirka');
assert.equal(resolvePlayerDisplayName('abc'), '');

const players: Record<string, import('@/types/scouting').ScoutingPlayerInfo> = {};
seedPlayerFromMatchStat(players, { playerId: 'p1', firstname: 'Jan', lastname: 'Kowalski', teamName: 'Legia' }, '2026-01-01');
assert.equal(players.p1?.firstname, 'Jan');
assert.equal(players.p1?.apiProfile, false);
seedPlayerFromMatchStat(players, { playerId: 'p1', firstname: 'Jan', lastname: 'Kowalski' }, '2026-01-02');
assert.equal(players.p1?.lastname, 'Kowalski');

console.log('playerNames.test.ts: OK');
