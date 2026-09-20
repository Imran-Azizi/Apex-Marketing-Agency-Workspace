import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSceneStockSearchQuery,
} from '../../src/services/ai/related-stock-images.js';

test('buildSceneStockSearchQuery keeps project subject words', () => {
  const q = buildSceneStockSearchQuery(
    'Wide shot luxury sofa living room cinematic commercial still Premium commercial cinematography still, 16:9',
    { title: 'SOFA LUX', visualDescription: 'beige luxury sofa in modern apartment' },
  );
  assert.match(q.toLowerCase(), /sofa|living|luxury|apartment|beige/);
  assert.doesNotMatch(q.toLowerCase(), /cinematography|watermark|widescreen/);
});

test('buildSceneStockSearchQuery falls back when empty', () => {
  const q = buildSceneStockSearchQuery('', {});
  assert.ok(q.length > 8);
});
