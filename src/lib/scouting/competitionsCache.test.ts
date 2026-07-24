import {
  loadScoutingCompetitionsStore,
  restoreCompetitionsForSex,
  saveCompetitionsFetch,
  saveCompetitionsSelection,
  getCachedLeagueGroups,
  allLeagueIdsFromGroups,
} from './competitionsCache';

let passed = 0;
let failed = 0;

const assert = (name: string, cond: boolean) => {
  if (cond) passed++;
  else {
    failed++;
    console.error('FAIL:', name);
  }
};

const mockStorage: Record<string, string> = {};
// @ts-expect-error test shim
global.localStorage = {
  getItem: (k: string) => mockStorage[k] ?? null,
  setItem: (k: string, v: string) => {
    mockStorage[k] = v;
  },
  removeItem: (k: string) => {
    delete mockStorage[k];
  },
};

const groups = [{ id: 'g1', name: 'Ekstraklasa', leagues: [{ leagueId: 'l1', name: 'Ekstraklasa' }] }];

saveCompetitionsFetch(
  'male',
  {
    seasons: [{ id: 's1', name: '2025/2026', isCurrent: true }],
    leagueGroups: groups,
    selectedSeasonId: 's1',
  },
  { seasonId: 's1', leagueIds: ['l1'] }
);

const restored = restoreCompetitionsForSex('male');
assert('restore seasons', restored?.seasons.length === 1);
assert('restore league groups', restored?.leagueGroups.length === 1);
assert('restore selection ids', restored?.leagueIds[0] === 'l1');
assert('all ids helper', allLeagueIdsFromGroups(groups)[0] === 'l1');

saveCompetitionsSelection('male', 's1', ['l1', 'l2']);
assert('selection update', restoreCompetitionsForSex('male')?.leagueIds.length === 2);
assert('cached groups', getCachedLeagueGroups('male', 's1')?.length === 1);
assert('store lastSex', loadScoutingCompetitionsStore()?.lastSex === 'male');

console.log(`scouting/competitionsCache.test: ${failed === 0 ? 'OK' : `FAIL (${failed})`}`);
if (failed > 0) process.exit(1);
