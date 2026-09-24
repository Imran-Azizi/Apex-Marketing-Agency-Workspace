import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKUP_TABLES,
  SKIP_TABLES,
  findMissingBackupTables,
  MEDIA_KEY_FIELDS,
} from '../../src/modules/backup/tables.js';
import { collectMediaKeysFromTables } from '../../src/modules/backup/media-keys.js';

test('BACKUP_TABLES covers every durable Prisma model', () => {
  const missing = findMissingBackupTables();
  assert.deepEqual(
    missing,
    [],
    `Missing from full-system backup: ${missing.join(', ')}`,
  );
});

test('BACKUP_TABLES excludes only ephemeral / catalog tables', () => {
  for (const name of SKIP_TABLES) {
    assert.equal(
      BACKUP_TABLES.includes(name),
      false,
      `${name} must not be in BACKUP_TABLES`,
    );
  }
  assert.ok(SKIP_TABLES.has('Session'));
  assert.ok(SKIP_TABLES.has('OtpCode'));
  assert.ok(SKIP_TABLES.has('SystemBackup'));
});

test('BACKUP_TABLES includes newly added domains', () => {
  for (const name of [
    'LandingPage',
    'PortfolioItem',
    'CompanyVideo',
    'ChatMessage',
    'UserPermission',
    'HeroSlide',
    'SalesAssistantRecommendation',
    'BusinessAssistantInsight',
  ]) {
    assert.ok(BACKUP_TABLES.includes(name), `expected ${name} in BACKUP_TABLES`);
  }
});

test('collectMediaKeysFromTables gathers scalar and landing JSON keys', () => {
  const keys = collectMediaKeysFromTables({
    ProjectFile: [{ storageKey: 'videos/projects/a.mp4' }],
    User: [{ profileImage: 'images/users/u1.jpg', cvStorageKey: null }],
    LandingPage: [
      {
        draftContent: {
          hero: { backgroundImageKey: 'images/landing/hero.jpg' },
          sections: [
            {
              elements: [
                { content: { imageKey: 'images/landing/el.png' } },
                { content: { videoKey: 'videos/landing/clip.mp4' } },
              ],
            },
          ],
        },
        publishedContent: null,
      },
    ],
  });

  assert.ok(keys.includes('videos/projects/a.mp4'));
  assert.ok(keys.includes('images/users/u1.jpg'));
  assert.ok(keys.includes('images/landing/hero.jpg'));
  assert.ok(keys.includes('images/landing/el.png'));
  assert.ok(keys.includes('videos/landing/clip.mp4'));
});

test('MEDIA_KEY_FIELDS maps known storage columns', () => {
  assert.ok(MEDIA_KEY_FIELDS.CompanyVideo.includes('storageKey'));
  assert.ok(MEDIA_KEY_FIELDS.HeroSlide.includes('mobileImageKey'));
  assert.ok(MEDIA_KEY_FIELDS.ChatAttachment.includes('storageKey'));
});
