import test from 'node:test';
import assert from 'node:assert/strict';
import {
  customerListScopeCondition,
  isActiveManagementCustomer,
} from '../../src/modules/crm/visibility.js';

test('pipeline scope shows all customers (no extra filter)', () => {
  assert.equal(customerListScopeCondition('pipeline'), null);
  assert.equal(customerListScopeCondition('PIPELINE'), null);
  assert.equal(customerListScopeCondition(undefined), null);
});

test('management scope lists transferred customers excluding delivered', () => {
  const condition = customerListScopeCondition('management');
  assert.deepEqual(condition, {
    AND: [
      { convertedAt: { not: null } },
      { pipelineStage: { notIn: ['DELIVERED'] } },
    ],
  });
});

test('isActiveManagementCustomer requires transfer and excludes delivered', () => {
  const transferred = new Date('2026-01-01T00:00:00.000Z');
  assert.equal(
    isActiveManagementCustomer({
      convertedAt: transferred,
      pipelineStage: 'PROJECT_CREATED',
    }),
    true,
  );
  assert.equal(
    isActiveManagementCustomer({
      convertedAt: transferred,
      pipelineStage: 'DELIVERED',
    }),
    false,
  );
  assert.equal(
    isActiveManagementCustomer({
      convertedAt: null,
      pipelineStage: 'PROJECT_CREATED',
      hasVerifiedPayment: true,
    }),
    false,
  );
});
