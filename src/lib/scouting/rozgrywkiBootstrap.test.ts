import assert from 'node:assert/strict';
import {
  resolveTokenBootstrapUrlCandidates,
  resolveTokenBootstrapUrl,
  buildEkstraklasaAnchorUrl,
  TOKEN_ANCHOR_LEAGUE_ID,
  CURRENT_SEASON_FALLBACK,
  EKSTRAKLASA_GROUP_FALLBACK,
} from './rozgrywkiBootstrap';
import { ROZGRYWKI_HOME_URL } from './rozgrywkiUrl';

const config = {
  seasonId: 'e9d66181-d03e-4bb3-b889-4da848f4831d',
  seasonName: '2025/2026',
  leagueId: '436dc4c6-bc94-4d30-ae92-1113d6d4eee3',
  leagueName: 'CLJ U-15',
  sex: 'male' as const,
};

void resolveTokenBootstrapUrlCandidates(config).then(async (candidates) => {
  assert.deepEqual(candidates, [ROZGRYWKI_HOME_URL]);
  assert.equal(await resolveTokenBootstrapUrl(config), ROZGRYWKI_HOME_URL);

  const anchor = buildEkstraklasaAnchorUrl(config.seasonId);
  assert.ok(anchor.includes(`leagueId=${TOKEN_ANCHOR_LEAGUE_ID}`));
  assert.ok(anchor.includes(`leagueGroup=${EKSTRAKLASA_GROUP_FALLBACK}`));
  assert.ok(anchor.includes(`season=${config.seasonId}`));
  assert.ok(!anchor.includes(CURRENT_SEASON_FALLBACK) || config.seasonId === CURRENT_SEASON_FALLBACK);

  console.log('rozgrywkiBootstrap.test.ts OK');
});
