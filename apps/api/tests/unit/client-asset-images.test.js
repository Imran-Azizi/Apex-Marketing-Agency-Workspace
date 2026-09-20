import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertClientAssetImageFile,
  CLIENT_ASSET_IMAGE_EXTENSIONS,
  isClientAssetImageKind,
  isSvgUpload,
} from '../../src/modules/files/image-formats.js';
import { sanitizeSvgContent } from '../../src/modules/files/svg-sanitize.js';

test('client asset image kinds detect logo and product only', () => {
  assert.equal(isClientAssetImageKind('LOGO'), true);
  assert.equal(isClientAssetImageKind('PRODUCT_IMAGE'), true);
  assert.equal(isClientAssetImageKind('VIDEO'), false);
  assert.equal(isClientAssetImageKind('BRANDBOOK'), false);
});

test('assertClientAssetImageFile accepts required formats', () => {
  const samples = [
    ['photo.jpg', 'image/jpeg'],
    ['photo.jpeg', 'image/jpeg'],
    ['photo.jfif', 'image/jpeg'],
    ['photo.jpe', 'image/jpeg'],
    ['photo.jif', 'image/pjpeg'],
    ['mark.png', 'image/png'],
    ['mark.webp', 'image/webp'],
    ['anim.gif', 'image/gif'],
    ['logo.svg', 'image/svg+xml'],
    ['scan.bmp', 'image/bmp'],
    ['scan.tiff', 'image/tiff'],
    ['scan.tif', 'image/tiff'],
    ['modern.avif', 'image/avif'],
  ];
  for (const [name, mimeType] of samples) {
    assert.doesNotThrow(
      () =>
        assertClientAssetImageFile({
          name,
          mimeType,
          sizeBytes: 1200,
          kind: 'PRODUCT_IMAGE',
        }),
      name,
    );
  }
});

test('assertClientAssetImageFile allows logo design extras', () => {
  assert.doesNotThrow(() =>
    assertClientAssetImageFile({
      name: 'brand.ai',
      mimeType: 'application/postscript',
      sizeBytes: 2000,
      kind: 'LOGO',
    }),
  );
  assert.throws(
    () =>
      assertClientAssetImageFile({
        name: 'brand.ai',
        mimeType: 'application/postscript',
        sizeBytes: 2000,
        kind: 'PRODUCT_IMAGE',
      }),
    (err) => err.code === 'INVALID_IMAGE',
  );
});

test('assertClientAssetImageFile rejects unsupported and mismatched types', () => {
  assert.throws(
    () =>
      assertClientAssetImageFile({
        name: 'evil.exe',
        mimeType: 'image/png',
        kind: 'PRODUCT_IMAGE',
      }),
    (err) => err.code === 'INVALID_IMAGE',
  );
  assert.throws(
    () =>
      assertClientAssetImageFile({
        name: 'photo.png',
        mimeType: 'application/pdf',
        kind: 'PRODUCT_IMAGE',
      }),
    (err) => err.code === 'INVALID_IMAGE',
  );
  assert.throws(
    () =>
      assertClientAssetImageFile({
        name: 'huge.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 6 * 1024 * 1024 * 1024,
        kind: 'PRODUCT_IMAGE',
      }),
    (err) => err.code === 'FILE_TOO_LARGE',
  );
  assert.equal(CLIENT_ASSET_IMAGE_EXTENSIONS.includes('svg'), true);
});

test('isSvgUpload detects svg by extension or mime', () => {
  assert.equal(isSvgUpload({ originalname: 'a.svg', mimetype: 'image/png' }), true);
  assert.equal(
    isSvgUpload({ originalname: 'a.png', mimetype: 'image/svg+xml' }),
    true,
  );
  assert.equal(isSvgUpload({ originalname: 'a.png', mimetype: 'image/png' }), false);
});

test('sanitizeSvgContent strips scriptable markup', () => {
  const dirty = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">
  <script>alert(1)</script>
  <circle cx="10" cy="10" r="5" fill="red"/>
  <a href="javascript:alert(1)"><text>x</text></a>
  <foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>x</script></body></foreignObject>
</svg>`;
  const clean = sanitizeSvgContent(dirty).toString('utf8');
  assert.match(clean, /<svg/i);
  assert.match(clean, /<circle/i);
  assert.doesNotMatch(clean, /<script/i);
  assert.doesNotMatch(clean, /onload=/i);
  assert.doesNotMatch(clean, /javascript:/i);
  assert.doesNotMatch(clean, /foreignObject/i);
});

test('sanitizeSvgContent rejects non-svg and strips entity declarations', () => {
  assert.throws(
    () => sanitizeSvgContent('<html><body>nope</body></html>'),
    (err) => err.code === 'INVALID_SVG',
  );
  const cleaned = sanitizeSvgContent(
    '<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg>',
  ).toString('utf8');
  assert.doesNotMatch(cleaned, /DOCTYPE/i);
  assert.doesNotMatch(cleaned, /ENTITY/i);
  assert.match(cleaned, /<circle/i);
});
