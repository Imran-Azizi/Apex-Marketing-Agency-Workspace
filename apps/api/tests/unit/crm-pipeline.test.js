import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalizeStage,
  deriveCategory,
  eventTargetStage,
  shouldApplyStage,
  getAllowedActions,
  canTransferToManagement,
  canManuallySetStage,
  isAutomaticStage,
  isActiveInManagement,
  manualStageOptions,
  CRM_EVENTS,
  stageRank,
  countCategoryFromStageTotals,
  stagesForCategory,
  buildCategoryWhere,
  customerQualifiesForFollowUp,
  categoryForStage,
} from '../../src/modules/crm/pipeline.js';
import { normalizeWhatsapp, parseInternationalPhone, getWhatsappLookupKeys, whatsappNumbersMatch } from '../../src/utils/whatsappNormalize.js';

test('canonicalizes legacy CRM stages', () => {
  assert.equal(canonicalizeStage('INTERESTED'), 'INFORMATION_SENT');
  assert.equal(canonicalizeStage('PRICE_SENT'), 'PROPOSAL_PRICE_SENT');
  assert.equal(canonicalizeStage('COMPLETED'), 'DELIVERED');
  assert.equal(canonicalizeStage('CANCELED'), 'LOST_CANCELED');
});

test('derives CRM categories — exactly one category per customer', () => {
  assert.equal(deriveCategory({ pipelineStage: 'NEW_LEAD' }), 'GHOST');
  assert.equal(deriveCategory({ pipelineStage: 'CONTACTED' }), 'GHOST');
  assert.equal(deriveCategory({ pipelineStage: 'INFORMATION_SENT' }), 'GHOST');
  assert.equal(deriveCategory({ pipelineStage: 'PROPOSAL_PRICE_SENT' }), 'INTERESTED');
  assert.equal(deriveCategory({ pipelineStage: 'WAITING_DECISION' }), 'FOLLOW_UP');
  assert.equal(deriveCategory({ pipelineStage: 'ORDER_CONFIRMED' }), 'FOLLOW_UP');
  assert.equal(deriveCategory({ pipelineStage: 'DEPOSIT_CONFIRMED', hasVerifiedPayment: true }), 'OUR_CUSTOMERS');
  assert.equal(deriveCategory({ pipelineStage: 'LOST_CANCELED' }), null);
});

test('category stage sets are mutually exclusive', () => {
  assert.deepEqual(stagesForCategory('GHOST'), [
    'NEW_LEAD',
    'CONTACTED',
    'INFORMATION_SENT',
  ]);
  assert.deepEqual(stagesForCategory('INTERESTED'), ['PROPOSAL_PRICE_SENT']);
  assert.deepEqual(stagesForCategory('FOLLOW_UP'), [
    'WAITING_DECISION',
    'ORDER_CONFIRMED',
    'DEPOSIT_PENDING',
    'DEPOSIT_CONFIRMED',
    'PORTAL_INVITED',
    'PROJECT_CREATED',
    'DELIVERED',
    'REPEAT_CUSTOMER',
  ]);
  assert.deepEqual(
    countCategoryFromStageTotals({
      NEW_LEAD: 2,
      CONTACTED: 1,
      INFORMATION_SENT: 1,
      PROPOSAL_PRICE_SENT: 4,
      WAITING_DECISION: 3,
      ORDER_CONFIRMED: 5,
      LOST_CANCELED: 9,
    }),
    {
      GHOST: 4,
      INTERESTED: 4,
      FOLLOW_UP: 8,
      OUR_CUSTOMERS: 0,
    },
  );
});

test('category filters do not overlap across ghost, interested, and follow-up', () => {
  assert.equal(categoryForStage('NEW_LEAD'), 'GHOST');
  assert.equal(categoryForStage('PROPOSAL_PRICE_SENT'), 'INTERESTED');
  assert.equal(categoryForStage('WAITING_DECISION'), 'FOLLOW_UP');
  assert.ok(buildCategoryWhere('GHOST'));
  assert.ok(buildCategoryWhere('FOLLOW_UP'));
});

test('automatic events only move the pipeline forward', () => {
  assert.equal(
    shouldApplyStage({ currentStage: 'NEW_LEAD', nextStage: 'CONTACTED', event: CRM_EVENTS.INTERACTION }),
    true,
  );
  assert.equal(
    shouldApplyStage({ currentStage: 'PROJECT_CREATED', nextStage: 'DEPOSIT_CONFIRMED', event: CRM_EVENTS.PAYMENT_CONFIRMED }),
    false,
  );
  assert.equal(
    shouldApplyStage({ currentStage: 'ORDER_CONFIRMED', nextStage: 'LOST_CANCELED', event: CRM_EVENTS.LOST }),
    true,
  );
  assert.ok(stageRank('DEPOSIT_CONFIRMED') > stageRank('ORDER_CONFIRMED'));
});

test('transfer to customer management is allowed before deposit, but not after convert or loss', () => {
  const sales = { roleCode: 'SALES', permissions: ['crm.create', 'crm.edit'] };
  assert.equal(
    getAllowedActions({ pipelineStage: 'CONTACTED', convertedAt: null }, sales).createCustomer,
    true,
  );
  assert.equal(
    getAllowedActions({ pipelineStage: 'CONTACTED', convertedAt: null }, sales).transferToManagement,
    true,
  );
  assert.equal(
    getAllowedActions({ pipelineStage: 'CONTACTED', convertedAt: new Date() }, sales).createCustomer,
    false,
  );
  assert.equal(
    getAllowedActions({ pipelineStage: 'CONTACTED', convertedAt: new Date() }, sales).transferToManagement,
    false,
  );
  assert.equal(
    getAllowedActions({ pipelineStage: 'LOST_CANCELED', convertedAt: null }, sales).createCustomer,
    false,
  );
  assert.equal(
    getAllowedActions({ pipelineStage: 'LOST_CANCELED', convertedAt: null }, sales).transferToManagement,
    false,
  );
  assert.equal(
    getAllowedActions({ pipelineStage: 'DELIVERED', convertedAt: null }, sales).transferToManagement,
    false,
  );
  assert.equal(
    getAllowedActions({ pipelineStage: 'REPEAT_CUSTOMER', convertedAt: null }, sales).transferToManagement,
    true,
  );
  assert.equal(canTransferToManagement({ pipelineStage: 'DELIVERED', convertedAt: null }), false);
  assert.equal(canTransferToManagement({ pipelineStage: 'ORDER_CONFIRMED', convertedAt: null }), true);
  assert.equal(
    deriveCategory({ pipelineStage: 'CONTACTED', hasVerifiedPayment: true }),
    'OUR_CUSTOMERS',
  );
});

test('isActiveInManagement matches OUR_CUSTOMERS category', () => {
  assert.equal(
    isActiveInManagement({ pipelineStage: 'PROJECT_CREATED', hasVerifiedPayment: true }),
    true,
  );
  assert.equal(
    isActiveInManagement({ pipelineStage: 'DELIVERED', hasVerifiedPayment: true }),
    true,
  );
  assert.equal(
    isActiveInManagement({ pipelineStage: 'REPEAT_CUSTOMER', hasVerifiedPayment: true }),
    true,
  );
  assert.equal(
    isActiveInManagement({
      pipelineStage: 'ORDER_CONFIRMED',
      convertedAt: new Date(),
      hasVerifiedPayment: false,
    }),
    false,
  );
  assert.equal(
    isActiveInManagement({ pipelineStage: 'LOST_CANCELED', hasVerifiedPayment: true }),
    false,
  );
  assert.equal(
    isActiveInManagement({ pipelineStage: 'CONTACTED', hasVerifiedPayment: false }),
    false,
  );
});

test('crm.edit allows manual selection of every configured stage', () => {
  const sales = { roleCode: 'SALES', permissions: ['crm.edit'] };
  assert.equal(isAutomaticStage('DEPOSIT_PENDING'), false);
  assert.equal(isAutomaticStage('DEPOSIT_CONFIRMED'), true);
  assert.equal(isAutomaticStage('REPEAT_CUSTOMER'), false);
  assert.equal(canManuallySetStage(sales, 'DEPOSIT_PENDING', 'ORDER_CONFIRMED'), true);
  assert.equal(canManuallySetStage(sales, 'DEPOSIT_CONFIRMED', 'DEPOSIT_PENDING'), true);
  assert.equal(canManuallySetStage(sales, 'PORTAL_INVITED', 'DEPOSIT_CONFIRMED'), true);
  assert.equal(canManuallySetStage(sales, 'PROJECT_CREATED', 'PORTAL_INVITED'), true);
  assert.equal(canManuallySetStage(sales, 'DELIVERED', 'PROJECT_CREATED'), true);
  assert.equal(canManuallySetStage(sales, 'REPEAT_CUSTOMER', 'DELIVERED'), true);
  assert.equal(canManuallySetStage(sales, 'LOST_CANCELED', 'PROJECT_CREATED'), true);
  assert.equal(canManuallySetStage(sales, 'CONTACTED', 'DEPOSIT_CONFIRMED'), true);
  assert.deepEqual(manualStageOptions('NEW_LEAD', sales).length, 13);
  assert.equal(
    getAllowedActions({ pipelineStage: 'CONTACTED', convertedAt: new Date() }, sales).markRepeatCustomer,
    true,
  );
});

test('payment confirmation targets deposit confirmed; sales events do not auto-advance', () => {
  assert.equal(eventTargetStage(CRM_EVENTS.PAYMENT_CONFIRMED, 'DEPOSIT_PENDING'), 'DEPOSIT_CONFIRMED');
  assert.equal(eventTargetStage(CRM_EVENTS.PAYMENT_SUBMITTED, 'ORDER_CONFIRMED'), null);
  assert.equal(eventTargetStage(CRM_EVENTS.INVOICE_CREATED, 'NEW_LEAD'), null);
  assert.equal(eventTargetStage(CRM_EVENTS.INTERACTION, 'NEW_LEAD'), null);
  assert.equal(eventTargetStage(CRM_EVENTS.PROJECT_CREATED, 'PORTAL_INVITED', { isRepeat: true }), 'PROJECT_CREATED');
  assert.equal(eventTargetStage(CRM_EVENTS.PORTAL_INVITED, 'DEPOSIT_CONFIRMED'), 'PORTAL_INVITED');
  assert.equal(eventTargetStage(CRM_EVENTS.PROJECT_DELIVERED, 'PROJECT_CREATED'), 'DELIVERED');
  assert.equal(eventTargetStage(CRM_EVENTS.REPEAT_ORDER, 'REPEAT_CUSTOMER'), null);
});

test('invoice creation is allowed before order confirmation', () => {
  const sales = { roleCode: 'SALES', permissions: ['finance.create', 'crm.opportunity'] };
  assert.equal(
    getAllowedActions({ pipelineStage: 'CONTACTED', convertedAt: null }, sales).createInvoice,
    true,
  );
  assert.equal(
    getAllowedActions({ pipelineStage: 'LOST_CANCELED', convertedAt: null }, sales).createInvoice,
    false,
  );
});

test('normalizes Afghan and international WhatsApp identities without country lock-in', () => {
  assert.equal(normalizeWhatsapp('۰۷۰۰۱۲۳۴۵۶'), '93700123456');
  assert.equal(normalizeWhatsapp('+93 700 123 456'), '93700123456');
  assert.equal(normalizeWhatsapp('0093700123456'), '93700123456');
  const iran = parseInternationalPhone('+989121234567');
  assert.equal(iran.digits, '989121234567');
  assert.equal(iran.country, 'IR');
  const uae = parseInternationalPhone('+971501234567');
  assert.equal(uae.digits, '971501234567');
  const us = parseInternationalPhone('+12025550123');
  assert.equal(us.digits, '12025550123');
});

test('legacy Afghan numbers match international equivalents', () => {
  assert.ok(whatsappNumbersMatch('0700123456', '+93700123456'));
  assert.ok(whatsappNumbersMatch('93700123456', '0700123456'));
  const keys = getWhatsappLookupKeys('+93700123456');
  assert.ok(keys.includes('93700123456'));
  assert.ok(keys.includes('0700123456'));
});
