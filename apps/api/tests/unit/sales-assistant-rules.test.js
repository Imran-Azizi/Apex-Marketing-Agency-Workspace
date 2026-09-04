import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS } from '../../src/modules/sales-assistant/constants.js';
import {
  evaluateSignals,
  isActivelyProgressing,
  detectObjections,
  detectIntentLevel,
} from '../../src/modules/sales-assistant/rules.js';
import { buildFingerprint } from '../../src/modules/sales-assistant/fingerprint.js';
import { assignPriority } from '../../src/modules/sales-assistant/priority.js';
import { composeRecommendation } from '../../src/modules/sales-assistant/compose.js';

test('defaults stay at 2 days decision waiting and 1 day pending deposit', () => {
  assert.equal(DEFAULT_SETTINGS.decisionWaitingDays, 2);
  assert.equal(DEFAULT_SETTINGS.pendingDepositDays, 1);
});

test('WAITING_DECISION past threshold without progress creates a follow-up', () => {
  const context = {
    customerId: 'c1',
    pipelineStage: 'WAITING_DECISION',
    daysInStage: 2.5,
    facts: [],
    activities: [],
    activitiesAfterStage: [],
    notes: '',
    orders: {},
  };
  const signals = evaluateSignals(context, DEFAULT_SETTINGS);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].kind, 'FOLLOW_UP');
});

test('WAITING_DECISION under threshold does not create a follow-up', () => {
  const context = {
    customerId: 'c1',
    pipelineStage: 'WAITING_DECISION',
    daysInStage: 1,
    facts: [],
    activities: [],
    activitiesAfterStage: [],
    notes: '',
    orders: {},
  };
  assert.equal(evaluateSignals(context, DEFAULT_SETTINGS).length, 0);
});

test('DEPOSIT_PENDING past 1 day without verified deposit creates deposit follow-up', () => {
  const context = {
    customerId: 'c1',
    pipelineStage: 'DEPOSIT_PENDING',
    daysInStage: 1.2,
    hasVerifiedDeposit: false,
    facts: [],
    activities: [],
    activitiesAfterStage: [],
    notes: '',
    orders: {},
  };
  const signals = evaluateSignals(context, DEFAULT_SETTINGS);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].kind, 'DEPOSIT_FOLLOW_UP');
});

test('repeat order window uses previous delivery evidence', () => {
  const context = {
    customerId: 'c1',
    pipelineStage: 'DELIVERED',
    daysInStage: 10,
    facts: [],
    activities: [],
    activitiesAfterStage: [],
    notes: '',
    orders: {
      deliveredCount: 2,
      daysSinceLastDelivered: 60,
      hasOpenSalesCycle: false,
    },
  };
  const signals = evaluateSignals(context, DEFAULT_SETTINGS);
  assert.equal(signals.some((s) => s.kind === 'REPEAT_ORDER'), true);
});

test('lost customers are ignored', () => {
  const context = {
    customerId: 'c1',
    pipelineStage: 'LOST_CANCELED',
    daysInStage: 10,
    facts: [],
    activities: [],
    activitiesAfterStage: [],
    notes: '',
    orders: {},
  };
  assert.equal(evaluateSignals(context, DEFAULT_SETTINGS).length, 0);
});

test('objections and intent are detected from conversation text', () => {
  const objections = detectObjections('قیمت برای ما زیاد است');
  assert.ok(objections.includes('price'));
  const intent = detectIntentLevel('آماده شروع هستیم');
  assert.equal(intent.level, 'high');
});

test('fingerprint stays stable until the next threshold bucket', () => {
  const signal = { kind: 'FOLLOW_UP', intentLevel: 'medium', objections: [] };
  const a = buildFingerprint(signal, { pipelineStage: 'WAITING_DECISION', daysInStage: 2.1 });
  const b = buildFingerprint(signal, { pipelineStage: 'WAITING_DECISION', daysInStage: 2.4 });
  assert.equal(a, b);
});

test('composed copy is specific and never a generic follow-up', () => {
  const signal = {
    kind: 'FOLLOW_UP',
    lastCustomerText: 'قیمت را بررسی می‌کنم',
    objections: ['price'],
  };
  const copy = composeRecommendation(signal, {
    personName: 'علی',
    pipelineStage: 'WAITING_DECISION',
    daysInStage: 2,
    orders: {},
  });
  assert.ok(copy.reason.includes('علی') || copy.reason.includes('انتظار'));
  assert.ok(copy.suggestedMessage?.length);
});

test('deposit follow-up priority is high', () => {
  const signal = { kind: 'DEPOSIT_FOLLOW_UP' };
  assert.equal(assignPriority(signal, { daysInStage: 1 }, DEFAULT_SETTINGS), 'HIGH');
});
