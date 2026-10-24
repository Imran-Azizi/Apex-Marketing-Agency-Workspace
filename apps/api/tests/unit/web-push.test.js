import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getVapidPublicKey,
  isWebPushConfigured,
} from '../../src/services/web-push.js';

test('web push reports configuration from env', () => {
  // Local .env should include VAPID keys after setup; if absent, feature disables cleanly.
  const configured = isWebPushConfigured();
  assert.equal(typeof configured, 'boolean');
  if (configured) {
    assert.ok(getVapidPublicKey());
    assert.match(String(getVapidPublicKey()), /^B/);
  } else {
    assert.equal(getVapidPublicKey(), null);
  }
});
