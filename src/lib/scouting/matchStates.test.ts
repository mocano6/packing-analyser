import assert from 'assert';
import {
  PLAYED_MATCH_STATE,
  WALKOVER_MATCH_STATE,
  isWalkoverMatchState,
  isPlayedMatchState,
  matchNeedsEventFetch,
  matchHasPlayerStats,
  matchEventsResolved,
  countWalkoverMatches,
  countMatchesWithEventsResolved,
  isLeagueEventsComplete,
  shouldSkipMatchSync,
} from './matchStates';

assert.equal(isWalkoverMatchState('Walkover'), true);
assert.equal(isWalkoverMatchState('walkover'), true);
assert.equal(isWalkoverMatchState(PLAYED_MATCH_STATE), false);
assert.equal(isPlayedMatchState(PLAYED_MATCH_STATE), true);
assert.equal(isPlayedMatchState(WALKOVER_MATCH_STATE), false);

{
  const now = new Date('2026-07-01T12:00:00Z');
  const played = {
    matchId: '1',
    dateTime: '2026-06-01T12:00:00Z',
    state: PLAYED_MATCH_STATE,
  };
  assert.equal(
    matchNeedsEventFetch(played, { now, existing: null, lastUpdated: null }),
    true,
    'rozegrany bez stats → fetch'
  );
  assert.equal(
    matchNeedsEventFetch(
      { ...played, state: WALKOVER_MATCH_STATE },
      { now, existing: null, lastUpdated: null }
    ),
    false,
    'walkover → nie fetch'
  );
  assert.equal(
    matchNeedsEventFetch(played, {
      now,
      existing: { ...played, playerStats: [{ id: 'p' }] },
      lastUpdated: new Date('2026-07-01T00:00:00Z'),
    }),
    false,
    'już ze stats i poza oknem → nie fetch'
  );
  assert.equal(
    matchNeedsEventFetch(played, {
      now,
      existing: { playerStats: [] },
      lastUpdated: new Date('2026-07-01T00:00:00Z'),
    }),
    false,
    'Rozegrany z pustym składem (events pobrane) → nie fetch ponownie'
  );
  assert.equal(matchEventsResolved({ playerStats: [] }), true);
  assert.equal(matchHasPlayerStats({ playerStats: [] }), false);
  assert.equal(matchEventsResolved({}), false);
  assert.equal(matchEventsResolved(null), false);
}

{
  const matches = [
    { matchId: 'a', dateTime: '2026-01-01', state: PLAYED_MATCH_STATE, playerStats: [{ x: 1 }] },
    { matchId: 'b', dateTime: '2026-01-02', state: PLAYED_MATCH_STATE, playerStats: [{ x: 1 }] },
    { matchId: 'c', dateTime: '2026-01-03', state: WALKOVER_MATCH_STATE },
  ];
  assert.equal(countWalkoverMatches(matches), 1);
  assert.equal(matchHasPlayerStats(matches[2]), false);
  assert.equal(isLeagueEventsComplete(matches), true, 'WO nie blokuje kompletności');
  assert.equal(
    isLeagueEventsComplete([
      ...matches,
      { matchId: 'd', dateTime: '2026-01-04', state: PLAYED_MATCH_STATE },
    ]),
    false
  );
  assert.equal(
    isLeagueEventsComplete([
      ...matches,
      { matchId: 'e', dateTime: '2026-01-05', state: PLAYED_MATCH_STATE, playerStats: [] },
    ]),
    true,
    'pusty skład po fetchu nie blokuje kompletności ligi'
  );
  assert.equal(
    countMatchesWithEventsResolved([
      { playerStats: [] },
      { playerStats: [{ x: 1 }] },
      {},
    ]),
    2
  );
  assert.equal(
    shouldSkipMatchSync({ isCurrentSeason: false, matches, playersNeedingProfile: 0 }),
    true
  );
  assert.equal(
    shouldSkipMatchSync({ isCurrentSeason: true, matches, playersNeedingProfile: 0 }),
    false,
    'sezon bieżący — nie skip (mogą dojść mecze)'
  );
  assert.equal(
    shouldSkipMatchSync({ isCurrentSeason: false, matches, playersNeedingProfile: 3 }),
    false,
    'brakujące profile — nie skip'
  );
}

console.log('scouting/matchStates.test: OK');
