import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isIdempotencyUniqueConflict,
  normalizeIdempotencyKey,
  withProjectCreateLock,
} from '../../src/modules/projects/projectCreateGuard.js';

test('normalizeIdempotencyKey accepts uuid-like keys and rejects junk', () => {
  assert.equal(
    normalizeIdempotencyKey('a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  );
  assert.equal(normalizeIdempotencyKey('   '), null);
  assert.equal(normalizeIdempotencyKey(undefined), null);
  assert.throws(
    () => normalizeIdempotencyKey('short'),
    (err) => err.status === 400,
  );
  assert.throws(
    () => normalizeIdempotencyKey('bad key with spaces!!'),
    (err) => err.status === 400,
  );
});

test('isIdempotencyUniqueConflict detects Prisma P2002 on the create key', () => {
  assert.equal(
    isIdempotencyUniqueConflict({
      code: 'P2002',
      meta: { target: ['createIdempotencyKey'] },
    }),
    true,
  );
  assert.equal(
    isIdempotencyUniqueConflict({
      code: 'P2002',
      meta: { target: 'projects_createIdempotencyKey_key' },
    }),
    true,
  );
  assert.equal(
    isIdempotencyUniqueConflict({
      code: 'P2002',
      meta: { target: ['code'] },
    }),
    false,
  );
  assert.equal(
    isIdempotencyUniqueConflict({
      code: 'P2010',
      message:
        'Raw query failed. Code: `23505`. Message: `duplicate key value violates unique constraint "projects_createIdempotencyKey_key"`',
    }),
    true,
  );
});

test('withProjectCreateLock coalesces concurrent work for the same key', async () => {
  let started = 0;
  let finished = 0;
  const job = async () => {
    started += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    finished += 1;
    return 'created';
  };

  const [a, b] = await Promise.all([
    withProjectCreateLock('same-key-123', job),
    withProjectCreateLock('same-key-123', job),
  ]);

  assert.equal(a, 'created');
  assert.equal(b, 'created');
  assert.equal(started, 1);
  assert.equal(finished, 1);
});
