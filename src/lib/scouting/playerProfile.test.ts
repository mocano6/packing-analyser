import assert from 'node:assert/strict';
import {
  fixIncompletePlayerProfiles,
  mergePlayerSeasonProfile,
  migrateLegacyPlayerSeasons,
  needsPlayerProfileFetch,
  parsePlayerAge,
  resolvePlayerSeasonProfile,
  sortPlayerIdsForProfileFetch,
} from './playerProfile';
import type { ScoutingPlayerInfo } from '@/types/scouting';

assert.equal(parsePlayerAge(25), 25);
assert.equal(parsePlayerAge('31'), 31);
assert.equal(parsePlayerAge(''), null);

const withAge: ScoutingPlayerInfo = {
  id: 'a',
  firstname: 'Jan',
  lastname: 'K',
  age: 20,
  birthYear: 2005,
  fetchedAt: '',
  bySeason: { s1: { age: 20, birthYear: 2005, fetchedAt: '' } },
  apiProfile: true,
};
assert.equal(needsPlayerProfileFetch(withAge, 's1'), false);
assert.equal(needsPlayerProfileFetch(withAge, 's2'), false);
assert.equal(needsPlayerProfileFetch(undefined, 's1'), true);

const legacy = resolvePlayerSeasonProfile(
  { id: 'x', firstname: '', lastname: '', age: 25, fetchedAt: '' },
  's1',
  '2025/2026'
);
assert.equal(legacy.age, 25);
assert.equal(legacy.birthYear, 2000);

const migratedState = {
  leagues: {
    k: {
      config: {
        seasonId: 's1',
        seasonName: '2025/2026',
        leagueId: 'l1',
        leagueName: 'Ekstraklasa',
        sex: 'male' as const,
      },
      lastUpdatedAt: null,
      isCurrentSeason: false,
      matches: [
        {
          matchId: 'm1',
          dateTime: '2026-01-01',
          queue: 1,
          state: 'Rozegrany',
          host: { id: 'h', name: 'H' },
          guest: { id: 'g', name: 'G' },
          scoreFinal: '1:0',
          scoreHalf: null,
          fetchedAt: '',
          playerStats: [{ playerId: 'p1', firstname: 'Jan', lastname: 'K', number: 9, teamId: 'h', teamName: 'H', isStarter: true, minutesPlayed: 90, goals: 0, goalMinutes: [], ownGoals: 0, yellowCards: 0, redCards: 0, subInMinute: null, subOutMinute: null }],
        },
      ],
    },
  },
  players: {
    p1: { id: 'p1', firstname: 'Jan', lastname: 'K', age: 14, fetchedAt: '' },
  },
};
assert.equal(migrateLegacyPlayerSeasons(migratedState), true);
assert.equal(migratedState.players.p1.bySeason?.s1?.birthYear, 2011);

const merged = mergePlayerSeasonProfile(
  { id: 'p1', firstname: 'Jan', lastname: 'K', age: null, fetchedAt: '' },
  's1',
  '2025/2026',
  14,
  '2026-01-01'
);
assert.equal(merged.bySeason?.s1?.birthYear, 2011);
assert.equal(merged.age, 14);

const state = {
  players: {
    p1: { id: 'p1', firstname: '', lastname: '', age: null, fetchedAt: '', apiProfile: true },
    p2: { id: 'p2', firstname: '', lastname: '', age: 22, fetchedAt: '', apiProfile: true },
  },
};
assert.equal(fixIncompletePlayerProfiles(state), true);
assert.equal(state.players.p1.apiProfile, false);

const sorted = sortPlayerIdsForProfileFetch(['p2', 'p1', 'p3'], state.players, 's1');
assert.equal(sorted[0], 'p3');
assert.equal(sorted.length, 3);

console.log('playerProfile.test.ts: OK');
