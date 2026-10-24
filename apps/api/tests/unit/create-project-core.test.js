import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveAgreedPrice,
  resolveOpportunityForProjectCreate,
} from '../../src/modules/projects/createProjectCore.js';
import { blankOpportunityCommercials } from '../../src/modules/crm/repeatCycle.js';

test('resolveAgreedPrice prefers positive opportunity contract price', () => {
  assert.equal(
    resolveAgreedPrice({ agreedPrice: 1200, proposedPrice: 900 }, 500),
    1200,
  );
  assert.equal(
    resolveAgreedPrice({ agreedPrice: null, proposedPrice: 900 }, 500),
    900,
  );
});

test('resolveAgreedPrice falls back to override when opportunity has no price', () => {
  assert.equal(
    resolveAgreedPrice({ agreedPrice: null, proposedPrice: null }, 750),
    750,
  );
  assert.equal(
    resolveAgreedPrice({ agreedPrice: 0, proposedPrice: 0 }, 750),
    750,
  );
});

test('resolveAgreedPrice returns 0 when neither source has a positive price', () => {
  assert.equal(resolveAgreedPrice({}, null), 0);
  assert.equal(resolveAgreedPrice({ agreedPrice: 0 }, 0), 0);
});

test('blankOpportunityCommercials clears all deal price fields', () => {
  const blank = blankOpportunityCommercials();
  assert.equal(blank.agreedPrice, null);
  assert.equal(blank.proposedPrice, null);
  assert.equal(blank.advancePayment, null);
  assert.equal(blank.agreedTerms, null);
  assert.equal(blank.contractLocked, false);
  assert.equal(blank.contractLockedAt, null);
  assert.equal(blank.contractLockedById, null);
});

test('resolveOpportunityForProjectCreate forces fresh cycle when alwaysCreateFresh', async () => {
  const created = {
    id: 'opp-fresh',
    agreedPrice: null,
    proposedPrice: null,
    projectId: null,
  };
  const tx = {
    opportunity: {
      findFirst: async () => {
        throw new Error('should not probe attachable when alwaysCreateFresh');
      },
      create: async () => created,
    },
  };
  const customer = { id: 'cust-1', personName: 'Ali' };
  const result = await resolveOpportunityForProjectCreate(tx, customer, {
    alwaysCreateFresh: true,
    title: 'پروژه دوم',
    pipelineStage: 'REPEAT_CUSTOMER',
  });
  assert.equal(result.created, true);
  assert.equal(result.opportunity.id, 'opp-fresh');
});

test('resolveOpportunityForProjectCreate rejects opportunity already linked to a live project', async () => {
  const tx = {
    opportunity: {
      findFirst: async () => ({
        id: 'opp-1',
        projectId: 'proj-1',
        agreedPrice: 5000,
      }),
    },
    project: {
      findFirst: async () => ({ id: 'proj-1' }),
    },
  };
  await assert.rejects(
    () =>
      resolveOpportunityForProjectCreate(tx, { id: 'cust-1' }, {
        opportunityId: 'opp-1',
      }),
    (err) => err?.code === 'OPPORTUNITY_IN_USE' || err?.statusCode === 409,
  );
});
