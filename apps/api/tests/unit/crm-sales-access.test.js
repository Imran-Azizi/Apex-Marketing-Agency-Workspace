import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSalesCustomerAccess,
  assertSalesCustomerListOwnerFilter,
  salesCustomerListFilter,
} from '../../src/modules/crm/salesAccess.js';

test('salesCustomerListFilter is null for managers', () => {
  assert.equal(salesCustomerListFilter({ roleCode: 'MANAGER', userId: 'm1' }), null);
});

test('salesCustomerListFilter does not restrict Sales users', () => {
  assert.equal(salesCustomerListFilter({ roleCode: 'SALES', userId: 's1' }), null);
});

test('assertSalesCustomerListOwnerFilter allows any owner for Sales', () => {
  assert.doesNotThrow(() =>
    assertSalesCustomerListOwnerFilter('other-rep', {
      roleCode: 'SALES',
      userId: 's1',
    }),
  );
});

test('assertSalesCustomerAccess allows other reps customers for Sales', () => {
  assert.doesNotThrow(() =>
    assertSalesCustomerAccess({ salesOwnerId: 'other-rep' }, {
      roleCode: 'SALES',
      userId: 's1',
    }),
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
