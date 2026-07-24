import assert from 'node:assert/strict';
import { computeBirthYear, parseSeasonStartYear } from './birthYear';

assert.equal(parseSeasonStartYear('2025/2026'), 2025);
assert.equal(parseSeasonStartYear('2024/2025'), 2024);
assert.equal(computeBirthYear(14, '2025/2026'), 2011);
assert.equal(computeBirthYear(15, '2026/2027'), 2011);
assert.equal(computeBirthYear(25, '2025/2026'), 2000);

console.log('birthYear.test.ts: OK');
