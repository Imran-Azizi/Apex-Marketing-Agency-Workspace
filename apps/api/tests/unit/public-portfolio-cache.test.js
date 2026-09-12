import test from 'node:test';
import assert from 'node:assert/strict';
import { createTtlCache } from '../../src/utils/ttlCache.js';
import {
  invalidatePublicPortfolioCache,
  publicOriginCache,
} from '../../src/modules/public/cache.js';

test('ttlCache invalidatePrefix clears matching keys only', async () => {
  const cache = createTtlCache();
  await cache.getOrSet('portfolio:mixed', 60_000, async () => ({ a: 1 }));
  await cache.getOrSet('portfolio:food', 60_000, async () => ({ b: 2 }));
  await cache.getOrSet('portfolio-slug:demo', 60_000, async () => ({ c: 3 }));
  await cache.getOrSet('hero', 60_000, async () => ({ d: 4 }));

  cache.invalidatePrefix('portfolio:');
  assert.equal(cache.get('portfolio:mixed'), undefined);
  assert.equal(cache.get('portfolio:food'), undefined);
  assert.deepEqual(cache.get('portfolio-slug:demo'), { c: 3 });
  assert.deepEqual(cache.get('hero'), { d: 4 });

  cache.invalidatePrefix('portfolio-slug:');
  assert.equal(cache.get('portfolio-slug:demo'), undefined);
  assert.deepEqual(cache.get('hero'), { d: 4 });
});

test('invalidatePublicPortfolioCache clears portfolio list/detail caches', async () => {
  await publicOriginCache.getOrSet('portfolio-categories', 60_000, async () => ({
    tabs: [],
  }));
  await publicOriginCache.getOrSet('portfolio:mixed', 60_000, async () => ({
    items: [],
  }));
  await publicOriginCache.getOrSet('portfolio-slug:x', 60_000, async () => ({
    id: 'x',
  }));
  await publicOriginCache.getOrSet('services', 60_000, async () => [1]);

  invalidatePublicPortfolioCache();

  assert.equal(publicOriginCache.get('portfolio-categories'), undefined);
  assert.equal(publicOriginCache.get('portfolio:mixed'), undefined);
  assert.equal(publicOriginCache.get('portfolio-slug:x'), undefined);
  assert.deepEqual(publicOriginCache.get('services'), [1]);
});
