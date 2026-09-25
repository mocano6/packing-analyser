import assert from 'node:assert/strict';
import { ROZGRYWKI_HOME_URL } from './rozgrywkiUrl';
import {
  isRozgrywkiHomePath,
  isSpa404Url,
  normalizeTokenMintUrlCandidates,
  shouldMarkAuthDeadOnSpa404,
  shouldReuseExistingCdpPage,
} from './tokenMintUrl';

assert.equal(isSpa404Url('https://www.laczynaspilka.pl/rozgrywki/404'), true);
assert.equal(isSpa404Url('https://www.laczynaspilka.pl/rozgrywki/404?x=1'), true);
assert.equal(isSpa404Url('https://www.laczynaspilka.pl/rozgrywki'), false);
assert.equal(
  isSpa404Url('https://www.laczynaspilka.pl/rozgrywki/druzyna/4b125148-f622-4b9c-88f9-4a83fd8b7b3b'),
  false
);

assert.equal(isRozgrywkiHomePath(ROZGRYWKI_HOME_URL), true);
assert.equal(isRozgrywkiHomePath(`${ROZGRYWKI_HOME_URL}/`), true);
assert.equal(isRozgrywkiHomePath(`${ROZGRYWKI_HOME_URL}?tab=tab-mecz`), true);
assert.equal(
  isRozgrywkiHomePath(
    'https://www.laczynaspilka.pl/rozgrywki/druzyna/4b125148-f622-4b9c-88f9-4a83fd8b7b3b?tab=tab-mecz'
  ),
  false
);

const teamPage =
  'https://www.laczynaspilka.pl/rozgrywki/druzyna/4b125148-f622-4b9c-88f9-4a83fd8b7b3b?tab=tab-mecz';
const matchPage = 'https://www.laczynaspilka.pl/rozgrywki/mecz/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

assert.deepEqual(normalizeTokenMintUrlCandidates([teamPage, ROZGRYWKI_HOME_URL]), [
  ROZGRYWKI_HOME_URL,
  teamPage,
]);
assert.deepEqual(normalizeTokenMintUrlCandidates([matchPage]), [ROZGRYWKI_HOME_URL, matchPage]);
assert.deepEqual(normalizeTokenMintUrlCandidates([]), [ROZGRYWKI_HOME_URL]);
assert.deepEqual(
  normalizeTokenMintUrlCandidates([`${ROZGRYWKI_HOME_URL}/404`, teamPage, teamPage]),
  [ROZGRYWKI_HOME_URL, teamPage]
);

assert.equal(shouldMarkAuthDeadOnSpa404(true), false);
assert.equal(shouldMarkAuthDeadOnSpa404(false), true);

assert.equal(shouldReuseExistingCdpPage(ROZGRYWKI_HOME_URL), true);
assert.equal(shouldReuseExistingCdpPage(`${ROZGRYWKI_HOME_URL}/404`), false);
assert.equal(shouldReuseExistingCdpPage(teamPage), false);
assert.equal(shouldReuseExistingCdpPage('about:blank'), false);

console.log('tokenMintUrl.test.ts OK');
