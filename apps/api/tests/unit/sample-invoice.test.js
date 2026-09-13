import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSampleCrmInvoice,
  financialInvoiceWhere,
  financialPaymentWhere,
  sampleInvoiceDisplayStatus,
  resolveSampleInvoicePaidAmount,
} from '../../src/modules/crm/sampleInvoice.js';
import { paymentsWhere } from '../../src/modules/crm/paymentFinance.js';

test('CRM sales invoices without contract/project are samples', () => {
  assert.equal(isSampleCrmInvoice({ opportunityId: null, projectId: null }), true);
  assert.equal(isSampleCrmInvoice({ opportunityId: 'opp-1', projectId: null }), false);
  assert.equal(isSampleCrmInvoice({ opportunityId: null, projectId: 'prj-1' }), false);
});

test('financial payment where excludes sample invoice payments', () => {
  const where = financialPaymentWhere();
  assert.ok(Array.isArray(where.OR));
  assert.deepEqual(where.OR[0], { invoiceId: null });
  assert.ok(where.OR.some((c) => c.invoice?.opportunityId?.not === null));
  assert.ok(where.OR.some((c) => c.invoice?.projectId?.not === null));
});

test('financial invoice where requires a contract or project', () => {
  const where = financialInvoiceWhere();
  assert.ok(where.OR.some((c) => c.opportunityId?.not === null));
  assert.ok(where.OR.some((c) => c.projectId?.not === null));
});

test('sample invoice display status follows quoted payable vs total', () => {
  assert.equal(sampleInvoiceDisplayStatus(1000, 0), 'ISSUED');
  assert.equal(sampleInvoiceDisplayStatus(1000, 400), 'PARTIALLY_PAID');
  assert.equal(sampleInvoiceDisplayStatus(1000, 1000), 'PAID');
});

test('sample payable prefers quoted amount over leftover payment sums', () => {
  assert.equal(resolveSampleInvoicePaidAmount({ quotedPaidAmount: 250 }, 900), 250);
  assert.equal(
    resolveSampleInvoicePaidAmount({ paymentMethodMeta: { quotedPaidAmount: 180 } }, 900),
    180,
  );
  assert.equal(resolveSampleInvoicePaidAmount({ quotedPaidAmount: 0 }, 900), 900);
  assert.equal(resolveSampleInvoicePaidAmount({ quotedPaidAmount: 0 }, 0), 0);
});

test('opportunity payment matching never includes unlinked sample invoices', () => {
  const where = paymentsWhere({
    crmCustomerId: 'cust-1',
    opportunityId: null,
  });
  assert.ok(where.OR.some((c) => c.invoiceId === null));
  assert.equal(
    where.OR.some((c) => c.invoiceId && c.invoiceId.not === null),
    false,
  );
});
