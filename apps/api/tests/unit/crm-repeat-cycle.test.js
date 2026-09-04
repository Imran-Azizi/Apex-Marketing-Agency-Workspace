import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFreshOpportunityData,
  snapshotCustomerProfile,
} from '../../src/modules/crm/repeatCycle.js';
import { canPortalCreateProject } from '../../src/modules/portal/helpers.js';

test('fresh repeat opportunity clears contract and payment fields', () => {
  const data = buildFreshOpportunityData({
    id: 'cust_1',
    personName: 'علی',
    companyName: 'شرکت نمونه',
  });
  assert.equal(data.crmCustomerId, 'cust_1');
  assert.equal(data.pipelineStage, 'REPEAT_CUSTOMER');
  assert.equal(data.projectId, null);
  assert.equal(data.agreedPrice, null);
  assert.equal(data.advancePayment, null);
  assert.equal(data.agreedTerms, null);
  assert.equal(data.contractLocked, false);
  assert.equal(data.serviceId, null);
  assert.match(data.title, /علی|شرکت نمونه/);
});

test('customer profile snapshot copies identity fields only', () => {
  const snap = snapshotCustomerProfile({
    personName: 'علی',
    whatsappRaw: '+93700123456',
    normalizedWhatsapp: '93700123456',
    source: 'WHATSAPP',
    salesOwnerId: 'user_1',
    companyName: 'شرکت',
    jobTitle: 'مدیر',
    phone: '0700123456',
    city: 'کابل',
    email: 'a@example.com',
    agreedPrice: 999,
  });
  assert.equal(snap.personName, 'علی');
  assert.equal(snap.email, 'a@example.com');
  assert.equal(snap.salesOwnerId, 'user_1');
  assert.equal(Object.prototype.hasOwnProperty.call(snap, 'agreedPrice'), false);
});

test('portal create-project permission requires pending brief or repeat status', () => {
  assert.equal(canPortalCreateProject({ pipelineStage: 'DELIVERED', pendingBriefsCount: 0 }), false);
  assert.equal(canPortalCreateProject({ pipelineStage: 'REPEAT_CUSTOMER', pendingBriefsCount: 0 }), true);
  assert.equal(canPortalCreateProject({ pipelineStage: 'DELIVERED', pendingBriefsCount: 1 }), true);
  assert.equal(canPortalCreateProject({ pipelineStage: 'PROJECT_CREATED', pendingBriefsCount: 0 }), false);
});
