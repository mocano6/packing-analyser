import assert from 'node:assert/strict';
import { withLaczyCrawlerLock } from './crawlerLock';

void (async () => {
  const order: number[] = [];
  const first = withLaczyCrawlerLock(async () => {
    await new Promise((r) => setTimeout(r, 20));
    order.push(1);
    return 'a';
  });
  const second = withLaczyCrawlerLock(async () => {
    order.push(2);
    return 'b';
  });

  const [a, b] = await Promise.all([first, second]);
  assert.equal(a, 'a');
  assert.equal(b, 'b');
  assert.deepEqual(order, [1, 2]);
  console.log('crawlerLock.test.ts OK');
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
