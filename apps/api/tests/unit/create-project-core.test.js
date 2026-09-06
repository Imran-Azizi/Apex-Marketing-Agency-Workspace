import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAgreedPrice } from '../../src/modules/projects/createProjectCore.js';

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
