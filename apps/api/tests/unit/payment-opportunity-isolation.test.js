import test from 'node:test';
import assert from 'node:assert/strict';
import {
  paymentMatchesOpportunity,
  paymentsWhere,
} from '../../src/modules/crm/paymentFinance.js';
import { resolvePaymentProjectId } from '../../src/modules/finance/kpis.js';

test('paymentsWhere scopes to one opportunity — no bare invoiceId:null', () => {
  const where = paymentsWhere({
    crmCustomerId: 'cust-1',
    opportunityId: 'opp-a',
  });
  assert.equal(where.crmCustomerId, 'cust-1');
  assert.deepEqual(where.OR, [
    { opportunityId: 'opp-a' },
    { invoice: { opportunityId: 'opp-a' } },
  ]);
  assert.equal(
    where.OR.some((clause) => Object.prototype.hasOwnProperty.call(clause, 'invoiceId')),
    false,
  );
});

test('paymentMatchesOpportunity does not bleed direct payments across cycles', () => {
  const oppA = { id: 'opp-a', crmCustomerId: 'cust-1' };
  const oppB = { id: 'opp-b', crmCustomerId: 'cust-1' };

  const scoped = {
    crmCustomerId: 'cust-1',
    opportunityId: 'opp-a',
    invoiceId: null,
  };
  assert.equal(paymentMatchesOpportunity(scoped, oppA), true);
  assert.equal(paymentMatchesOpportunity(scoped, oppB), false);

  const orphan = {
    crmCustomerId: 'cust-1',
    opportunityId: null,
    invoiceId: null,
  };
  assert.equal(paymentMatchesOpportunity(orphan, oppA), false);
  assert.equal(paymentMatchesOpportunity(orphan, oppB), false);

  const viaInvoice = {
    crmCustomerId: 'cust-1',
    opportunityId: null,
    invoiceId: 'inv-1',
    invoice: { opportunityId: 'opp-b' },
  };
  assert.equal(paymentMatchesOpportunity(viaInvoice, oppA), false);
  assert.equal(paymentMatchesOpportunity(viaInvoice, oppB), true);
});

test('resolvePaymentProjectId prefers payment.opportunityId over customer bleed', () => {
  const indexes = {
    byProjectId: new Map([
      ['proj-a', {}],
      ['proj-b', {}],
    ]),
    byOpportunityId: new Map([
      ['opp-a', 'proj-a'],
      ['opp-b', 'proj-b'],
    ]),
    byCustomerId: new Map([['cust-1', ['proj-a', 'proj-b']]]),
  };

  assert.equal(
    resolvePaymentProjectId(
      {
        opportunityId: 'opp-b',
        invoiceId: null,
        crmCustomerId: 'cust-1',
        invoice: null,
      },
      indexes,
    ),
    'proj-b',
  );

  // Legacy orphan with multiple projects must not attach to all / any
  assert.equal(
    resolvePaymentProjectId(
      {
        opportunityId: null,
        invoiceId: null,
        crmCustomerId: 'cust-1',
        invoice: null,
      },
      indexes,
    ),
    null,
  );
});
