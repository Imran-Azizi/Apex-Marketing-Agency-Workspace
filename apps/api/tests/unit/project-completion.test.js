import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPaymentFullySettled,
  hasCustomerFinalVideoApproval,
} from '../../src/services/projectCompletion.js';

test('isPaymentFullySettled requires received >= price', () => {
  assert.equal(isPaymentFullySettled(null), false);
  assert.equal(isPaymentFullySettled({ finalProjectPrice: 100, received: 50 }), false);
  assert.equal(isPaymentFullySettled({ finalProjectPrice: 100, received: 100 }), true);
  assert.equal(isPaymentFullySettled({ finalProjectPrice: 100, received: 120 }), true);
  assert.equal(isPaymentFullySettled({ finalProjectPrice: '200', received: '200' }), true);
  assert.equal(isPaymentFullySettled({ finalProjectPrice: 0, received: 0 }), true);
});

test('hasCustomerFinalVideoApproval only for post-approval statuses', () => {
  assert.equal(
    hasCustomerFinalVideoApproval({ projectStatus: 'WAITING_CLIENT_FINAL_APPROVAL' }),
    false,
  );
  assert.equal(
    hasCustomerFinalVideoApproval({ projectStatus: 'WAITING_PAYMENT' }),
    true,
  );
  assert.equal(
    hasCustomerFinalVideoApproval({ projectStatus: 'READY_TO_DOWNLOAD' }),
    true,
  );
  assert.equal(
    hasCustomerFinalVideoApproval({ projectStatus: 'COMPLETED' }),
    true,
  );
  assert.equal(
    hasCustomerFinalVideoApproval({ projectStatus: 'MANAGER_FINAL_REVIEW' }),
    false,
  );
});
