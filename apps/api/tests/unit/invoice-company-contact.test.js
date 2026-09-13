import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCompanyContact } from '../../src/modules/settings/company-contact.js';
import { buildInvoiceDocumentHtml } from '../../src/modules/crm/invoiceDocumentHtml.js';
import { buildPaymentReceiptHtml } from '../../src/modules/crm/paymentReceiptHtml.js';
import { buildBillFooterHtml } from '../../src/modules/crm/billBranding.js';

test('Settings contact values win over env fallbacks', () => {
  const contact = resolveCompanyContact({
    emailValue: { email: 'office@apex.af' },
    phoneValue: { number: '93711112222' },
    fallbackEmail: 'info@apex.af',
    fallbackPhone: '93700000000',
  });
  assert.equal(contact.email, 'office@apex.af');
  assert.equal(contact.phone, '93711112222');
});

test('falls back to env when Settings are empty', () => {
  const contact = resolveCompanyContact({
    emailValue: null,
    phoneValue: { number: '   ' },
    fallbackEmail: 'info@apex.af',
    fallbackPhone: '93700000000',
  });
  assert.equal(contact.email, 'info@apex.af');
  assert.equal(contact.phone, '93700000000');
});

test('invoice HTML uses payable label and Settings footer contact', () => {
  const html = buildInvoiceDocumentHtml({
    id: 'inv_1',
    invoiceNumber: 'INV-2026-00001',
    total: 5000,
    paidAmount: 1500,
    status: 'PARTIALLY_PAID',
    paymentMethodLabel: 'نقدی / حضوری',
    company: {
      phone: '93774294004',
      email: 'billing@apex.af',
      website: 'apex.af',
    },
    customer: { personName: 'احمد' },
  });
  assert.match(html, /مبلغ قابل پرداخت/);
  assert.equal(html.includes('مبلغ پرداخت شده'), false);
  assert.equal(html.includes('مبلغ باقی‌مانده'), false);
  assert.equal(html.includes('باقیمانده'), false);
  assert.match(html, /93774294004/);
  assert.match(html, /billing@apex\.af/);
});

test('payment receipt HTML does not include remaining balance', () => {
  const html = buildPaymentReceiptHtml({
    payment: {
      paymentNumber: 'PAY-1',
      paidAt: '2026-09-13T10:00:00.000Z',
      amount: 1000,
      method: 'CASH',
      recordedByName: 'احمد',
    },
    customer: { personName: 'مشتری' },
    finance: { totalAmount: 2000, remainingBalance: 1000 },
    invoice: { videoCount: 1, paymentMethod: 'CASH' },
  });
  assert.equal(html.includes('مبلغ باقی‌مانده'), false);
  assert.match(html, /مبلغ پرداخت شده/);
});

test('bill footer renders live phone and email', () => {
  const html = buildBillFooterHtml({
    phone: '93711112222',
    email: 'office@apex.af',
    website: 'localhost:3000',
  });
  assert.match(html, /93711112222/);
  assert.match(html, /office@apex\.af/);
  assert.match(html, /localhost:3000/);
});
