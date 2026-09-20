import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  collageGrid,
} from '../../src/services/ai/storyboard-image-prompt.js';
import {
  composeStoryboardSheet,
  storyboardSheetLayout,
  renderLocalSceneStill,
} from '../../src/services/ai/storyboard-sheet.js';

const jpeg = createRequire(import.meta.url)('jpeg-js');

function solidJpeg(width, height, r, g, b) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const o = i * 4;
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
    data[o + 3] = 255;
  }
  return Buffer.from(jpeg.encode({ data, width, height }, 85).data);
}

test('collageGrid scales with scene count without splitting into separate images', () => {
  assert.deepEqual(collageGrid(1), { cols: 1, rows: 1 });
  assert.deepEqual(collageGrid(2), { cols: 2, rows: 1 });
  assert.deepEqual(collageGrid(3), { cols: 3, rows: 1 });
  assert.deepEqual(collageGrid(4), { cols: 2, rows: 2 });
  assert.deepEqual(collageGrid(6), { cols: 3, rows: 2 });
  assert.deepEqual(collageGrid(8), { cols: 4, rows: 2 });
  assert.deepEqual(collageGrid(9), { cols: 3, rows: 3 });
  assert.equal(collageGrid(6).cols * collageGrid(6).rows >= 6, true);
  assert.equal(collageGrid(11).cols * collageGrid(11).rows >= 11, true);
});

test('storyboardSheetLayout keeps unused cells empty for 5 scenes', () => {
  const layout = storyboardSheetLayout(5);
  assert.equal(layout.cols, 3);
  assert.equal(layout.rows, 2);
  assert.equal(layout.n, 5);
  assert.equal(layout.unused, 1);
  assert.equal(layout.panelW, 960);
  assert.equal(layout.panelH, 540);
  assert.ok(layout.width > 1800);
  assert.ok(layout.height > 1000);
});

test('composeStoryboardSheet builds one jpeg matching the 5-scene layout', async () => {
  const colors = [
    { r: 200, g: 40, b: 40 },
    { r: 40, g: 180, b: 40 },
    { r: 40, g: 40, b: 200 },
    { r: 220, g: 200, b: 40 },
    { r: 40, g: 200, b: 200 },
  ];
  const panels = colors.map((color, i) => ({
    buffer: solidJpeg(320, 180, color.r, color.g, color.b),
    sceneNumber: i + 1,
    title: `Scene ${i + 1}`,
  }));
  const sheet = await composeStoryboardSheet(panels);
  const decoded = jpeg.decode(sheet);
  const layout = storyboardSheetLayout(5);
  assert.equal(decoded.width, layout.width);
  assert.equal(decoded.height, layout.height);
  assert.ok(sheet.length > 20_000);

  const px = (x, y) => {
    const o = (y * decoded.width + x) * 4;
    return [decoded.data[o], decoded.data[o + 1], decoded.data[o + 2]];
  };
  const [r1] = px(layout.pad + 80, layout.pad + 80);
  const [r2, g2] = px(layout.pad + layout.panelW + layout.gutter + 80, layout.pad + 80);
  assert.ok(r1 > 150, 'scene 1 panel should stay red');
  assert.ok(g2 > 120 && r2 < 120, 'scene 2 panel should stay green');
});

test('renderLocalSceneStill produces a distinct jpeg per scene', () => {
  const a = renderLocalSceneStill({
    sceneNumber: 1,
    title: 'Opening shot',
    visual: 'Wide product hero',
  });
  const b = renderLocalSceneStill({
    sceneNumber: 2,
    title: 'Detail',
    visual: 'Close-up texture',
  });
  assert.ok(a.length > 8_000);
  assert.ok(b.length > 8_000);
  assert.notEqual(a.compare(b), 0);
  const decoded = jpeg.decode(a);
  assert.equal(decoded.width, 1920);
  assert.equal(decoded.height, 1080);
});

test('composeStoryboardSheet works with local reference stills only', async () => {
  const panels = [1, 2, 3].map((n) => ({
    buffer: renderLocalSceneStill({ sceneNumber: n, title: `Scene ${n}` }),
    sceneNumber: n,
    title: `Scene ${n}`,
  }));
  const sheet = await composeStoryboardSheet(panels);
  const decoded = jpeg.decode(sheet);
  const layout = storyboardSheetLayout(3);
  assert.equal(decoded.width, layout.width);
  assert.equal(decoded.height, layout.height);
  assert.ok(sheet.length > 30_000);
});
