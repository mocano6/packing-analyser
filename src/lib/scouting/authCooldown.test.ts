import assert from 'node:assert/strict';
import {
  authCooldownRemainingMs,
  formatAuthCooldownMessage,
  SCOUTING_AUTH_COOLDOWN_MS,
} from './authCooldown';

assert.equal(authCooldownRemainingMs(1000, null), 0);
assert.equal(authCooldownRemainingMs(1000, Number.NaN), 0);
assert.equal(authCooldownRemainingMs(100_000, 10_000, 90_000), 0);
assert.equal(authCooldownRemainingMs(50_000, 10_000, 90_000), 50_000);
assert.equal(SCOUTING_AUTH_COOLDOWN_MS, 90_000);

assert.equal(formatAuthCooldownMessage(0), null);
const msg = formatAuthCooldownMessage(73_000);
assert.ok(msg && msg.includes('73 s'));
assert.ok(msg && msg.includes('Odśwież podgląd'));

console.log('authCooldown.test.ts OK');
