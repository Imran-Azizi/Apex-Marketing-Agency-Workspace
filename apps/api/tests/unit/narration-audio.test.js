import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertNarrationAudioFile,
  assertNarrationAudioStorageKey,
  NARRATION_AUDIO_EXTENSIONS,
  NARRATION_AUDIO_MIME,
} from '../../src/modules/narration/audio.js';

test('narration audio allow-list includes required formats', () => {
  for (const ext of ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'webm']) {
    assert.equal(NARRATION_AUDIO_EXTENSIONS.includes(ext), true, ext);
  }
  assert.equal(NARRATION_AUDIO_MIME.has('audio/mpeg'), true);
  assert.equal(NARRATION_AUDIO_MIME.has('audio/flac'), true);
  assert.equal(NARRATION_AUDIO_MIME.has('audio/webm'), true);
  assert.equal(NARRATION_AUDIO_MIME.has('application/pdf'), false);
});

test('assertNarrationAudioFile accepts common formats', () => {
  assert.doesNotThrow(() =>
    assertNarrationAudioFile({ name: 'take.mp3', mimeType: 'audio/mpeg', sizeBytes: 1000 }),
  );
  assert.doesNotThrow(() =>
    assertNarrationAudioFile({ name: 'take.wav', mimeType: 'audio/wav', sizeBytes: 1000 }),
  );
  assert.doesNotThrow(() =>
    assertNarrationAudioFile({ name: 'take.m4a', mimeType: 'audio/mp4', sizeBytes: 1000 }),
  );
  assert.doesNotThrow(() =>
    assertNarrationAudioFile({ name: 'take.aac', mimeType: 'audio/aac', sizeBytes: 1000 }),
  );
  assert.doesNotThrow(() =>
    assertNarrationAudioFile({ name: 'take.ogg', mimeType: 'audio/ogg', sizeBytes: 1000 }),
  );
  assert.doesNotThrow(() =>
    assertNarrationAudioFile({ name: 'take.flac', mimeType: 'audio/flac', sizeBytes: 1000 }),
  );
  assert.doesNotThrow(() =>
    assertNarrationAudioFile({ name: 'take.webm', mimeType: 'audio/webm', sizeBytes: 1000 }),
  );
  assert.doesNotThrow(() =>
    assertNarrationAudioFile({
      name: 'take.mp3',
      mimeType: 'application/octet-stream',
      sizeBytes: 1000,
    }),
  );
});

test('assertNarrationAudioFile rejects unsupported or unsafe types', () => {
  assert.throws(
    () => assertNarrationAudioFile({ name: 'evil.exe', mimeType: 'audio/mpeg' }),
    (err) => err.code === 'INVALID_AUDIO',
  );
  assert.throws(
    () => assertNarrationAudioFile({ name: 'clip.mp3', mimeType: 'application/pdf' }),
    (err) => err.code === 'INVALID_AUDIO',
  );
  assert.throws(
    () => assertNarrationAudioFile({ name: 'clip.txt', mimeType: 'text/plain' }),
    (err) => err.code === 'INVALID_AUDIO',
  );
});

test('assertNarrationAudioFile rejects oversized files', () => {
  assert.throws(
    () =>
      assertNarrationAudioFile({
        name: 'huge.mp3',
        mimeType: 'audio/mpeg',
        sizeBytes: 6 * 1024 * 1024 * 1024,
      }),
    (err) => err.code === 'FILE_TOO_LARGE',
  );
});

test('assertNarrationAudioStorageKey accepts project audio paths', () => {
  const key = assertNarrationAudioStorageKey(
    'projects/proj123/audio/123-abcdef.mp3',
    'proj123',
  );
  assert.equal(key, 'projects/proj123/audio/123-abcdef.mp3');
  assert.equal(
    assertNarrationAudioStorageKey('project-audio/old-file.mp3', 'proj123'),
    'project-audio/old-file.mp3',
  );
});

test('assertNarrationAudioStorageKey rejects foreign project paths', () => {
  assert.throws(
    () =>
      assertNarrationAudioStorageKey(
        'projects/other-project/audio/123.mp3',
        'proj123',
      ),
    (err) => err.code === 'INVALID_STORAGE_KEY',
  );
  assert.throws(
    () => assertNarrationAudioStorageKey('../etc/passwd', 'proj123'),
    (err) => err.code === 'INVALID_STORAGE_KEY',
  );
  assert.throws(
    () => assertNarrationAudioStorageKey('images/hero/banner.jpg', 'proj123'),
    (err) => err.code === 'INVALID_STORAGE_KEY',
  );
});
