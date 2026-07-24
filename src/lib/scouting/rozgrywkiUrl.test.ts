import assert from 'node:assert/strict';
import { buildRozgrywkiUrl, findLeagueGroupId } from './rozgrywkiUrl';
import type { ScoutingLeagueGroup } from '@/types/scouting';

const url = buildRozgrywkiUrl('season-1', 'group-1', 'league-1', 'male');
assert.ok(url.includes('season=season-1'));
assert.ok(url.includes('leagueGroup=group-1'));
assert.ok(url.includes('leagueId=league-1'));
assert.ok(url.includes('genderType=Male'));

const groups: ScoutingLeagueGroup[] = [
  {
    id: 'g-clj',
    name: 'CLJ',
    leagues: [{ leagueId: 'clj-u15', name: 'CLJ U-15' }],
  },
];
assert.equal(findLeagueGroupId(groups, 'clj-u15'), 'g-clj');
assert.equal(findLeagueGroupId(groups, 'missing'), null);

console.log('rozgrywkiUrl.test.ts OK');
