import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPublicCopyKey,
  parsePublicCopyValue,
  sanitizePublicCopyText,
  normalizePublicCopyInput,
  PUBLIC_COPY_KEYS,
  PUBLIC_COPY_MAX,
} from '../../src/modules/settings/public-copy.js';

test('isPublicCopyKey only accepts the five public description keys', () => {
  assert.equal(isPublicCopyKey(PUBLIC_COPY_KEYS.company), true);
  assert.equal(isPublicCopyKey(PUBLIC_COPY_KEYS.contact), true);
  assert.equal(isPublicCopyKey('contact_email'), false);
  assert.equal(isPublicCopyKey('whatsapp_number'), false);
});

test('sanitizePublicCopyText strips tags and control characters', () => {
  const text = sanitizePublicCopyText(
    '  سلام <script>alert(1)</script>\nخط دوم  \u0000  ',
  );
  assert.equal(text.includes('<script>'), false);
  assert.equal(text.includes('سلام'), true);
  assert.equal(text.includes('خط دوم'), true);
});

test('parsePublicCopyValue reads { text } payloads and strings', () => {
  assert.equal(parsePublicCopyValue({ text: 'خدمات ما' }), 'خدمات ما');
  assert.equal(parsePublicCopyValue('متن ساده'), 'متن ساده');
  assert.equal(parsePublicCopyValue({ description: 'جایگزین' }), 'جایگزین');
  assert.equal(parsePublicCopyValue(null), '');
});

test('normalizePublicCopyInput stores sanitized text and rejects oversize', () => {
  const payload = normalizePublicCopyInput({ text: '  توضیح بخش  ' });
  assert.deepEqual(payload, { text: 'توضیح بخش' });

  assert.throws(
    () => normalizePublicCopyInput({ text: 'x'.repeat(PUBLIC_COPY_MAX + 1) }),
    /کاراکتر/,
  );
});
