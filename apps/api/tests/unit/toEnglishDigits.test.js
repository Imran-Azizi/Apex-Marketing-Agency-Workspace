import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toEnglishDigits,
  hasEasternDigits,
  normalizeDigitsDeep,
} from '../../src/utils/toEnglishDigits.js';
import { normalizeWhatsapp } from '../../src/utils/whatsappNormalize.js';

test('toEnglishDigits converts Persian digits', () => {
  assert.equal(toEnglishDigits('۰۹۸۷۶۵۴۳۲۱'), '0987654321');
});

test('toEnglishDigits converts Arabic-Indic digits', () => {
  assert.equal(toEnglishDigits('٠١٢٣٤٥٦٧٨٩'), '0123456789');
});

test('toEnglishDigits leaves mixed text intact except digits', () => {
  assert.equal(toEnglishDigits('قیمت: ۱۲۳ افغانی'), 'قیمت: 123 افغانی');
});

test('toEnglishDigits is a no-op for ASCII', () => {
  assert.equal(toEnglishDigits('0987654321'), '0987654321');
});

test('toEnglishDigits handles non-strings', () => {
  assert.equal(toEnglishDigits(null), null);
  assert.equal(toEnglishDigits(42), 42);
});

test('hasEasternDigits detects Persian and Arabic digits', () => {
  assert.equal(hasEasternDigits('۰۱'), true);
  assert.equal(hasEasternDigits('٠١'), true);
  assert.equal(hasEasternDigits('01'), false);
});

test('normalizeDigitsDeep walks body/query-like objects', () => {
  const payload = {
    q: '۰۹۸۷',
    nested: { phone: '٠٧٠٠١٢٣٤٥٦', tags: ['۱۲', 'ok'] },
    count: 3,
  };
  normalizeDigitsDeep(payload);
  assert.deepEqual(payload, {
    q: '0987',
    nested: { phone: '0700123456', tags: ['12', 'ok'] },
    count: 3,
  });
});

test('normalizeWhatsapp accepts Persian local numbers', () => {
  assert.equal(normalizeWhatsapp('۰۷۰۰۱۲۳۴۵۶'), '93700123456');
});
