import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatReceiptVideoCount,
  parseVideoCountFromText,
  resolveReceiptPaymentMethod,
  resolveReceiptVideoCount,
  toPositiveInt,
  videoCountFromInvoiceItems,
} from '../../src/modules/crm/receiptDisplay.js';

test('toPositiveInt accepts numbers, numeric strings, and Prisma-like decimals', () => {
  assert.equal(toPositiveInt(2), 2);
  assert.equal(toPositiveInt('3'), 3);
  assert.equal(toPositiveInt({ toNumber: () => 4 }), 4);
  assert.equal(toPositiveInt(0), null);
  assert.equal(toPositiveInt(null), null);
  assert.equal(toPositiveInt('—'), null);
});

test('resolves video count from invoice.videoCount first', () => {
  assert.equal(
    resolveReceiptVideoCount({
      invoiceVideoCount: 2,
      invoiceItems: [{ quantity: 9, description: 'خدمات تولید محتوای ویدیویی' }],
      projectCount: 1,
    }),
    2,
  );
});

test('falls back to invoice item quantity when videoCount is missing', () => {
  assert.equal(
    resolveReceiptVideoCount({
      invoiceVideoCount: null,
      invoiceItems: [{ quantity: '2.00', description: 'تولید 2 ویدیو' }],
    }),
    2,
  );
  assert.equal(
    videoCountFromInvoiceItems([{ quantity: 3, description: 'خدمات تولید محتوای ویدیویی' }]),
    3,
  );
});

test('parses video count from agreed terms when invoice is missing', () => {
  assert.equal(parseVideoCountFromText('فاکتور CRM — 4 ویدیو'), 4);
  assert.equal(
    resolveReceiptVideoCount({
      agreedTerms: 'تولید 2 ویدیو برای کمپین بهار',
      projectCount: 9,
    }),
    2,
  );
});

test('falls back to project count last', () => {
  assert.equal(resolveReceiptVideoCount({ projectCount: 2 }), 2);
  assert.equal(formatReceiptVideoCount(2), '2');
  assert.equal(formatReceiptVideoCount(null), '—');
});

test('payment method uses recorded payment then invoice method', () => {
  assert.equal(
    resolveReceiptPaymentMethod({ method: 'CASH' }),
    'نقدی / حضوری',
  );
  assert.equal(
    resolveReceiptPaymentMethod({ method: 'HESAB_PAY' }),
    'حساب پی',
  );
  assert.equal(
    resolveReceiptPaymentMethod({ method: null, invoiceMethod: 'BANK_TRANSFER' }),
    'انتقال بانکی',
  );
  assert.equal(
    resolveReceiptPaymentMethod({ methodLabel: 'حواله', method: 'CASH' }),
    'حواله',
  );
});
