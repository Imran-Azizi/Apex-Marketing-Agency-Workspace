import test from 'node:test';
import assert from 'node:assert/strict';
import { formatAiError } from '../../src/services/ai/errors.js';

test('formatAiError treats connection resets as retryable', () => {
  const reset = formatAiError({ code: 'ECONNRESET', message: 'read ECONNRESET' });
  assert.equal(reset.retryable, true);
  assert.equal(reset.code, 'server_error');
  assert.match(reset.messageFa, /در دسترس نیست/);

  const undici = formatAiError({
    message: 'fetch failed',
    cause: { code: 'UND_ERR_SOCKET', message: 'other side closed' },
  });
  assert.equal(undici.retryable, true);

  const terminated = formatAiError({
    code: 'UND_ERR_SOCKET',
    message: 'terminated',
  });
  assert.equal(terminated.retryable, true);
});

test('formatAiError maps HTTP 402 and credit messages to quota', () => {
  const paid = formatAiError({
    status: 402,
    body: '{"error":{"message":"This request requires more credits","code":402}}',
  });
  assert.equal(paid.code, 'insufficient_quota');
  assert.equal(paid.retryable, false);
});
