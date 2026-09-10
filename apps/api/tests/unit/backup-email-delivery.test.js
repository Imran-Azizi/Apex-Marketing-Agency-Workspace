import test from 'node:test';
import assert from 'node:assert/strict';
import {
  backupEmailDeliveryPlan,
  buildBackupEmailContent,
  normalizeBackupRecipientEmail,
  resolveBackupRecipientEmail,
  safeEmailErrorMessage,
  withBackupEmailLock,
} from '../../src/modules/backup/emailDelivery.js';

test('normalizeBackupRecipientEmail validates and lowercases', () => {
  assert.equal(normalizeBackupRecipientEmail('  Admin@Example.COM '), 'admin@example.com');
  assert.equal(normalizeBackupRecipientEmail(''), '');
  assert.equal(normalizeBackupRecipientEmail('not-an-email'), null);
});

test('resolveBackupRecipientEmail prefers schedule over env', () => {
  assert.equal(
    resolveBackupRecipientEmail({ emailTo: 'ops@apex.af' }),
    'ops@apex.af',
  );
  assert.equal(resolveBackupRecipientEmail({ emailTo: '' }), '');
  assert.equal(resolveBackupRecipientEmail({ emailTo: 'bad' }), null);
});

test('backupEmailDeliveryPlan skips already-sent and missing SMTP/recipient', () => {
  assert.deepEqual(
    backupEmailDeliveryPlan({
      emailTo: 'ops@apex.af',
      emailSentAt: new Date(),
    }),
    { shouldSend: false, reason: 'already_sent' },
  );
  assert.equal(
    backupEmailDeliveryPlan({ emailTo: '', emailSentAt: null }).reason,
    'no_recipient',
  );
  assert.equal(
    backupEmailDeliveryPlan({
      emailTo: 'ops@apex.af',
      emailSentAt: null,
      smtpConfigured: false,
    }).reason,
    'smtp_not_configured',
  );
  assert.equal(
    backupEmailDeliveryPlan({
      emailTo: 'ops@apex.af',
      emailSentAt: null,
      smtpConfigured: true,
    }).reason,
    'ready',
  );
});

test('buildBackupEmailContent uses professional subject and includes metadata', () => {
  const createdAt = new Date('2026-09-10T12:30:00.000Z');
  const content = buildBackupEmailContent({
    fileName: 'apex-backup.json.gz',
    backupId: 'bk-1',
    type: 'MANUAL',
    sizeLabel: '1.2 MB',
    createdAt,
    attached: true,
  });
  assert.match(content.subject, /^System Backup – /);
  assert.match(content.text, /APEX SYSTEM/);
  assert.match(content.text, /apex-backup\.json\.gz/);
  assert.match(content.text, /Manual/);
  assert.match(content.html, /bk-1/);
});

test('safeEmailErrorMessage redacts credential-like fragments', () => {
  const msg = safeEmailErrorMessage(
    new Error('SMTP auth failed password=secret123 auth=login'),
  );
  assert.equal(msg.includes('secret123'), false);
  assert.equal(msg.includes('[redacted]'), true);
});

test('withBackupEmailLock prevents concurrent duplicate work', async () => {
  let runs = 0;
  const job = async () => {
    runs += 1;
    await new Promise((r) => setTimeout(r, 20));
    return 'sent';
  };
  const [a, b] = await Promise.all([
    withBackupEmailLock('bk-lock', job),
    withBackupEmailLock('bk-lock', job),
  ]);
  assert.equal(a, 'sent');
  assert.deepEqual(b, { skipped: true, reason: 'in_flight' });
  assert.equal(runs, 1);
});
