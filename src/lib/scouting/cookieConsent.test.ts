import assert from 'node:assert/strict';
import {
  USERCENTRICS_ACCEPT_SELECTORS,
  USERCENTRICS_DENY_SELECTORS,
  USERCENTRICS_ROOT_SELECTOR,
} from './cookieConsent';

assert.equal(USERCENTRICS_ROOT_SELECTOR, '#usercentrics-root');
assert.ok(USERCENTRICS_ACCEPT_SELECTORS.some((s) => s.includes('uc-accept-all-button')));
assert.ok(USERCENTRICS_DENY_SELECTORS.some((s) => s.includes('uc-deny-all-button')));

console.log('cookieConsent.test.ts OK');
