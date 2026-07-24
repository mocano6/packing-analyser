import {
  sliceWithLimit,
  isBearerStillFresh,
  PLAYER_FETCH_CHUNK,
  DEFAULT_MAX_MATCHES_PER_SYNC,
  DEFAULT_MAX_PLAYERS_PER_SYNC,
  TOKEN_MAX_AGE_MS,
  DEFAULT_BURST_SIZE,
} from './syncLimits';

let passed = 0;
let failed = 0;

const assert = (name: string, cond: boolean) => {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error('FAIL:', name);
  }
};

{
  const items = [1, 2, 3];
  const r = sliceWithLimit(items, 10);
  assert('under limit slice', r.slice.length === 3 && r.remaining === 0);
}

{
  const items = Array.from({ length: 100 }, (_, i) => i);
  const { slice, remaining } = sliceWithLimit(items, 40);
  assert('cap slice length', slice.length === 40);
  assert('cap slice start', slice[0] === 0);
  assert('cap slice end', slice[39] === 39);
  assert('cap remaining', remaining === 60);
}

{
  const items = [1, 2];
  assert('zero limit no cap', sliceWithLimit(items, 0).slice.length === 2);
  assert('negative limit no cap', sliceWithLimit(items, -5).slice.length === 2);
}

{
  const t0 = 1_000_000;
  assert('fresh under max age', isBearerStillFresh(t0, t0 + 500, TOKEN_MAX_AGE_MS));
  assert('stale over max age', !isBearerStillFresh(t0, t0 + TOKEN_MAX_AGE_MS + 1, TOKEN_MAX_AGE_MS));
  assert('missing tokenAt', !isBearerStillFresh(0, t0, TOKEN_MAX_AGE_MS));
}

assert('burst size fits token window', DEFAULT_BURST_SIZE <= 10);
assert('player chunk modest', PLAYER_FETCH_CHUNK <= 20);
assert('players per sync modest', DEFAULT_MAX_PLAYERS_PER_SYNC <= 100);
assert('matches per sync raised', DEFAULT_MAX_MATCHES_PER_SYNC >= 40);

console.log(`scouting/syncLimits.test: ${failed === 0 ? 'OK' : `FAIL (${failed})`}`);
if (failed > 0) process.exit(1);
