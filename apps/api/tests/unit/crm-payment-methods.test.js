import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizePaymentMethodMeta,
  assertPaymentMethodMeta,
  formatPaymentMethod,
  formatPaymentMethodMetaRows,
} from '../../src/modules/crm/paymentMethods.js';

test('keeps only fields for the selected payment method', () => {
  const hesab = sanitizePaymentMethodMeta('HESAB_PAY', {
    hesabPayAccount: ' 12345 ',
    officeAddress: 'should drop',
    bankCardNumber: '999',
  });
  assert.deepEqual(hesab, { hesabPayAccount: '12345' });

  const cash = sanitizePaymentMethodMeta('CASH', {
    officeAddress: 'Kabul office',
    responsiblePhone: '0700123456',
    hesabPayAccount: 'drop',
  });
  assert.equal(cash.officeAddress, 'Kabul office');
  assert.equal(cash.responsiblePhone, '0700123456');
  assert.equal(cash.hesabPayAccount, undefined);

  const bank = sanitizePaymentMethodMeta('BANK_TRANSFER', {
    bankCardNumber: '6037-1234',
    officeAddress: 'drop',
  });
  assert.deepEqual(bank, { bankCardNumber: '6037-1234' });
});

test('requires method-specific invoice details', () => {
  assert.throws(
    () => assertPaymentMethodMeta('HESAB_PAY', {}),
    (err) => err?.status === 400,
  );
  assert.doesNotThrow(() =>
    assertPaymentMethodMeta('HESAB_PAY', { hesabPayAccount: '111' }),
  );
  assert.throws(
    () => assertPaymentMethodMeta('CASH', { officeAddress: 'Office' }),
    (err) => err?.status === 400,
  );
  assert.doesNotThrow(() =>
    assertPaymentMethodMeta('CASH', {
      officeAddress: 'Office',
      responsiblePhone: '0700',
    }),
  );
  assert.throws(
    () => assertPaymentMethodMeta('BANK_TRANSFER', {}),
    (err) => err?.status === 400,
  );
});

test('labels cash as in-person and bank transfer distinctly', () => {
  assert.equal(formatPaymentMethod('CASH'), 'نقدی / حضوری');
  assert.equal(formatPaymentMethod('BANK_TRANSFER'), 'انتقال بانکی');
  assert.equal(formatPaymentMethod('HESAB_PAY'), 'حساب پی');
});

test('formatPaymentMethodMetaRows shows only selected method details', () => {
  assert.deepEqual(
    formatPaymentMethodMetaRows('CASH', {
      officeAddress: 'Kabul Office',
      responsiblePhone: '0700123456',
      hesabPayAccount: 'drop',
    }),
    [
      { label: 'آدرس دفتر', value: 'Kabul Office' },
      { label: 'شماره تماس مسئول دفتر', value: '0700123456', ltr: true },
    ],
  );

  assert.deepEqual(
    formatPaymentMethodMetaRows('HAWALA', {
      bankInfo: 'Sarafi ABC / ref 44',
      bankCardNumber: 'should-drop',
    }),
    [{ label: 'جزئیات حواله', value: 'Sarafi ABC / ref 44' }],
  );

  assert.deepEqual(
    formatPaymentMethodMetaRows('HESAB_PAY', {
      hesabPayAccount: '998877',
      officeAddress: 'drop',
    }),
    [{ label: 'شماره حساب پی', value: '998877', ltr: true }],
  );

  assert.deepEqual(
    formatPaymentMethodMetaRows('BANK_TRANSFER', {
      bankCardNumber: '6037-1234',
      bankInfo: 'should-drop',
    }),
    [{ label: 'شماره کارت بانکی', value: '6037-1234', ltr: true }],
  );
});
