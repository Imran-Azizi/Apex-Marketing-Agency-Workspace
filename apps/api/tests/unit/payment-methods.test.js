import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CUSTOMER_PAYMENT_METHODS,
  formatPaymentMethod,
  isCustomerPaymentMethod,
} from '../../src/modules/crm/paymentMethods.js';
import {
  recordPaymentSchema,
  updatePaymentSchema,
} from '../../src/modules/crm/service.js';

test('customer payments allow exactly the three supported methods', () => {
  assert.deepEqual(CUSTOMER_PAYMENT_METHODS, [
    'CASH',
    'HAWALA',
    'HESAB_PAY',
  ]);
  assert.equal(isCustomerPaymentMethod('CASH'), true);
  assert.equal(isCustomerPaymentMethod('HAWALA'), true);
  assert.equal(isCustomerPaymentMethod('HESAB_PAY'), true);
  assert.equal(isCustomerPaymentMethod('BANK_TRANSFER'), false);
  assert.equal(isCustomerPaymentMethod(''), false);
});

test('payment method labels remain safe for legacy or missing records', () => {
  assert.equal(formatPaymentMethod('CASH'), 'حضوری');
  assert.equal(formatPaymentMethod('HAWALA'), 'حواله');
  assert.equal(formatPaymentMethod('HESAB_PAY'), 'حساب پی');
  assert.equal(formatPaymentMethod('BANK_TRANSFER'), 'انتقال بانکی');
  assert.equal(formatPaymentMethod(null), 'ثبت نشده');
  assert.equal(formatPaymentMethod('UNKNOWN'), 'ثبت نشده');
});

test('payment API requires a supported method on create', () => {
  for (const method of CUSTOMER_PAYMENT_METHODS) {
    assert.equal(
      recordPaymentSchema.safeParse({
        opportunityId: 'opportunity-id',
        amount: 100,
        method,
      }).success,
      true,
    );
  }

  for (const method of [undefined, 'BANK_TRANSFER', 'OTHER', 'UNKNOWN']) {
    const payload = {
      opportunityId: 'opportunity-id',
      amount: 100,
      ...(method ? { method } : {}),
    };
    assert.equal(recordPaymentSchema.safeParse(payload).success, false);
  }
});

test('payment API permits editing to supported methods only', () => {
  assert.equal(updatePaymentSchema.safeParse({ method: 'HESAB_PAY' }).success, true);
  assert.equal(updatePaymentSchema.safeParse({ amount: 200 }).success, true);
  assert.equal(
    updatePaymentSchema.safeParse({ method: 'BANK_TRANSFER' }).success,
    false,
  );
});
