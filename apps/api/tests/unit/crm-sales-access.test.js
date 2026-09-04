import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../../src/utils/response.js';
import {
  assertSalesCustomerAccess,
  assertSalesCustomerListOwnerFilter,
  salesCustomerListFilter,
} from '../../src/modules/crm/salesAccess.js';

test('salesCustomerListFilter is null for managers', () => {
  assert.equal(salesCustomerListFilter({ roleCode: 'MANAGER', userId: 'm1' }), null);
});

test('salesCustomerListFilter scopes to own and unassigned leads', () => {
  assert.deepEqual(salesCustomerListFilter({ roleCode: 'SALES', userId: 's1' }), {
    OR: [{ salesOwnerId: 's1' }, { salesOwnerId: null }],
  });
});

test('assertSalesCustomerListOwnerFilter blocks other reps', () => {
  assert.throws(
    () =>
      assertSalesCustomerListOwnerFilter('other-rep', {
        roleCode: 'SALES',
        userId: 's1',
      }),
    (err) => err instanceof AppError && err.code === 'FORBIDDEN',
  );
});

test('assertSalesCustomerAccess blocks other reps customers', () => {
  assert.throws(
    () =>
      assertSalesCustomerAccess({ salesOwnerId: 'other-rep' }, {
        roleCode: 'SALES',
        userId: 's1',
      }),
    (err) => err instanceof AppError && err.code === 'FORBIDDEN',
  );
});

test('assertSalesCustomerAccess allows unassigned and own customers', () => {
  assert.doesNotThrow(() =>
    assertSalesCustomerAccess({ salesOwnerId: null }, {
      roleCode: 'SALES',
      userId: 's1',
    }),
  );
  assert.doesNotThrow(() =>
    assertSalesCustomerAccess({ salesOwnerId: 's1' }, {
      roleCode: 'SALES',
      userId: 's1',
    }),
  );
});
