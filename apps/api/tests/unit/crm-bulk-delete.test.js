import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bulkDeleteCustomersSchema,
  crmService,
  normalizeBulkCustomerIds,
} from '../../src/modules/crm/service.js';
import { AppError } from '../../src/utils/response.js';

test('bulk delete schema requires 1 to 100 customer ids', () => {
  assert.equal(bulkDeleteCustomersSchema.safeParse({ ids: [] }).success, false);
  assert.equal(
    bulkDeleteCustomersSchema.safeParse({ ids: ['cust-1'] }).success,
    true,
  );
  assert.equal(
    bulkDeleteCustomersSchema.safeParse({
      ids: Array.from({ length: 100 }, (_, i) => `cust-${i + 1}`),
    }).success,
    true,
  );
  assert.equal(
    bulkDeleteCustomersSchema.safeParse({
      ids: Array.from({ length: 101 }, (_, i) => `cust-${i + 1}`),
    }).success,
    false,
  );
  assert.equal(
    bulkDeleteCustomersSchema.safeParse({ ids: [''] }).success,
    false,
  );
  assert.equal(bulkDeleteCustomersSchema.safeParse({}).success, false);
});

test('normalizeBulkCustomerIds trims, drops blanks, and de-duplicates', () => {
  assert.deepEqual(normalizeBulkCustomerIds([' a ', 'a', '', 'b', null]), [
    'a',
    'b',
  ]);
  assert.deepEqual(normalizeBulkCustomerIds([]), []);
  assert.deepEqual(normalizeBulkCustomerIds(undefined), []);
});

test('bulkDeleteCustomers deletes unique ids in one pass and reports partial failures', async () => {
  const original = crmService.softDeleteCustomer;
  const calls = [];
  crmService.softDeleteCustomer = async (id) => {
    calls.push(id);
    if (id === 'blocked') {
      throw new AppError('حذف مجاز نیست', 403, 'FORBIDDEN');
    }
    return { id };
  };
  try {
    const result = await crmService.bulkDeleteCustomers(
      ['keep-1', 'keep-1', 'blocked', 'keep-2'],
      { userId: 'u1', roleCode: 'ADMIN' },
      {},
    );
    assert.deepEqual(calls, ['keep-1', 'blocked', 'keep-2']);
    assert.equal(result.selected, 3);
    assert.deepEqual(result.deleted, [{ id: 'keep-1' }, { id: 'keep-2' }]);
    assert.equal(result.failed.length, 1);
    assert.equal(result.failed[0].id, 'blocked');
    assert.equal(result.failed[0].message, 'حذف مجاز نیست');
  } finally {
    crmService.softDeleteCustomer = original;
  }
});

test('bulkDeleteCustomers throws when every selected record fails', async () => {
  const original = crmService.softDeleteCustomer;
  crmService.softDeleteCustomer = async () => {
    throw new AppError('مشتری یافت نشد', 404, 'NOT_FOUND');
  };
  try {
    await assert.rejects(
      () => crmService.bulkDeleteCustomers(['missing'], { userId: 'u1' }, {}),
      (err) =>
        err instanceof AppError &&
        err.status === 404 &&
        err.message === 'مشتری یافت نشد',
    );
  } finally {
    crmService.softDeleteCustomer = original;
  }
});
