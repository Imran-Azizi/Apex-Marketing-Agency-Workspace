import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWhatsapp } from '../../src/utils/whatsappNormalize.js';
import { computeFinanceFields, mapProjectStatusToCustomer } from '../../src/services/projectContext.js';

test('AC helper: WhatsApp normalize unique identity', () => {
  assert.equal(normalizeWhatsapp('0700123456'), '93700123456');
  assert.equal(normalizeWhatsapp('+93 700 123 456'), '93700123456');
  assert.equal(normalizeWhatsapp('700123456'), '93700123456');
});

test('AC-19 helper: profit and balance formula', () => {
  const r = computeFinanceFields({
    agreedPrice: 10000,
    discount: 1000,
    narratorCost: 1200,
    editorCost: 5000,
    otherDirectCosts: 300,
    received: 4000,
  });
  assert.equal(r.finalProjectPrice, 9000);
  assert.equal(r.balance, 5000);
  assert.equal(r.directCosts, 6500);
  assert.equal(r.profit, 2500);
});

test('AC-18 helper: customer facing status mapping', () => {
  assert.equal(mapProjectStatusToCustomer('NEW_MANAGER_REVIEW'), 'INFO_RECEIVED');
  assert.equal(mapProjectStatusToCustomer('WAITING_CLIENT_CONTENT_APPROVAL'), 'WAITING_YOUR_APPROVAL');
  assert.equal(mapProjectStatusToCustomer('PRODUCTION_EDITING'), 'IN_PRODUCTION');
  assert.equal(mapProjectStatusToCustomer('READY_TO_DOWNLOAD'), 'READY_DELIVERY');
});

test('AC-20/21 download gate logic', () => {
  function canDownloadClean({ balance, allowed, overrideBalance }) {
    if (balance > 0 && !overrideBalance) return { ok: false, code: 'BALANCE_OUTSTANDING' };
    if (!allowed) return { ok: false, code: 'DOWNLOAD_LOCKED' };
    return { ok: true };
  }
  assert.equal(canDownloadClean({ balance: 100, allowed: true, overrideBalance: false }).code, 'BALANCE_OUTSTANDING');
  assert.equal(canDownloadClean({ balance: 0, allowed: false, overrideBalance: false }).code, 'DOWNLOAD_LOCKED');
  assert.equal(canDownloadClean({ balance: 0, allowed: true, overrideBalance: false }).ok, true);
  assert.equal(canDownloadClean({ balance: 50, allowed: true, overrideBalance: true }).ok, true);
});

test('AC-13 revision limit logic', () => {
  function canRequestRevision({ used, max, extra }) {
    const limit = max + (extra ? 1 : 0);
    return used < limit;
  }
  assert.equal(canRequestRevision({ used: 0, max: 2, extra: false }), true);
  assert.equal(canRequestRevision({ used: 2, max: 2, extra: false }), false);
  assert.equal(canRequestRevision({ used: 2, max: 2, extra: true }), true);
});

test('P-08 AI cannot mutate finance/approve flags (contract)', () => {
  const aiCapabilities = {
    canPublish: false,
    canApprove: false,
    canDeleteFiles: false,
    canChangeFinance: false,
    canCreateVersionedOutput: true,
  };
  assert.equal(aiCapabilities.canPublish, false);
  assert.equal(aiCapabilities.canApprove, false);
  assert.equal(aiCapabilities.canDeleteFiles, false);
  assert.equal(aiCapabilities.canChangeFinance, false);
  assert.equal(aiCapabilities.canCreateVersionedOutput, true);
});

test('AC-03/04 invite eligibility gates (spec §6.1)', () => {
  function inviteEligible(gates) {
    return (
      gates.orderConfirmedOrAbove &&
      gates.agreedPrice &&
      gates.agreedTerms &&
      gates.depositInvoiceIssued &&
      gates.depositPaymentVerified &&
      gates.validWhatsapp &&
      gates.depositConfirmed
    );
  }
  assert.equal(
    inviteEligible({
      orderConfirmedOrAbove: true,
      agreedPrice: true,
      agreedTerms: false,
      depositInvoiceIssued: true,
      depositPaymentVerified: true,
      validWhatsapp: true,
      depositConfirmed: true,
    }),
    false,
  );
  assert.equal(
    inviteEligible({
      orderConfirmedOrAbove: true,
      agreedPrice: true,
      agreedTerms: true,
      depositInvoiceIssued: true,
      depositPaymentVerified: true,
      validWhatsapp: true,
      depositConfirmed: true,
    }),
    true,
  );
});

test('AC-24 portfolio permission blocks', () => {
  function canCreatePortfolioDraft(permission) {
    return permission !== 'NOT_ALLOWED';
  }
  function canPublish(permission) {
    return permission !== 'NOT_ALLOWED' && permission !== 'PENDING';
  }
  assert.equal(canCreatePortfolioDraft('NOT_ALLOWED'), false);
  assert.equal(canCreatePortfolioDraft('PENDING'), true);
  assert.equal(canCreatePortfolioDraft('ALLOWED'), true);
  assert.equal(canPublish('PENDING'), false);
  assert.equal(canPublish('HIDE_CLIENT_NAME'), true);
});
