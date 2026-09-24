/**
 * Full-system backup archive pack/unpack (tar.gz).
 * Layout:
 *   manifest.json
 *   database.json.gz
 *   media-index.json
 *   media/<storageKey...>
 */
import crypto from 'crypto';
import { spawn } from 'child_process';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { createWriteStream, createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip, createGunzip } from 'zlib';
import { AppError } from '../../utils/response.js';

export const ARCHIVE_FORMAT = 'apex-backup';
export const ARCHIVE_VERSION = 2;
export const LEGACY_VERSION = 1;

function runTar(args, { cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('tar', args, {
      cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (err) => {
      reject(
        new AppError(
          `ابزار tar در دسترس نیست: ${err.message}`,
          500,
          'BACKUP_TAR_MISSING',
        ),
      );
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else {
        reject(
          new AppError(
            `ساخت/استخراج آرشیو ناموفق بود${stderr ? `: ${stderr.slice(0, 400)}` : ''}`,
            500,
            'BACKUP_TAR_FAILED',
          ),
        );
      }
    });
  });
}

/** Safe relative path under media/ for a storage key. */
export function mediaRelPath(storageKey) {
  const key = String(storageKey || '')
    .replace(/^\/+/, '')
    .replace(/\\/g, '/');
  if (!key || key.includes('..') || path.isAbsolute(key)) {
    throw new AppError('کلید فایل رسانه نامعتبر است', 400, 'BACKUP_BAD_MEDIA_KEY');
  }
  return path.join('media', ...key.split('/').filter(Boolean));
}

export async function ensureEmptyDir(dir) {
  await fsp.rm(dir, { recursive: true, force: true });
  await fsp.mkdir(dir, { recursive: true });
}

export async function writeJsonGzip(filePath, data) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const json = JSON.stringify(data);
  await pipeline(
    async function* () {
      yield Buffer.from(json, 'utf8');
    },
    createGzip({ level: 6 }),
    createWriteStream(filePath),
  );
  return Buffer.byteLength(json);
}

export async function readJsonGzipFile(filePath) {
  const chunks = [];
  await pipeline(createReadStream(filePath), createGunzip(), async function* (source) {
    for await (const chunk of source) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
  });
  const raw = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(raw);
}

export async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => h.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(h.digest('hex')));
  });
}

export async function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function writeManifest(stagingDir, manifest) {
  const file = path.join(stagingDir, 'manifest.json');
  await fsp.writeFile(file, JSON.stringify(manifest, null, 2), 'utf8');
  return file;
}

export async function writeMediaIndex(stagingDir, entries) {
  const file = path.join(stagingDir, 'media-index.json');
  await fsp.writeFile(file, JSON.stringify({ files: entries }, null, 2), 'utf8');
  return file;
}

/**
 * Create tar.gz from staging directory contents.
 * @returns {Promise<{ archivePath: string, sizeBytes: number, checksum: string }>}
 */
export async function packStagingDir(stagingDir, archivePath) {
  await fsp.mkdir(path.dirname(archivePath), { recursive: true });
  try {
    await fsp.unlink(archivePath);
  } catch {
    /* ok */
  }

  // Portable: pack everything under staging into archivePath
  const archiveName = path.basename(archivePath);
  const parent = path.dirname(archivePath);
  // Write into parent with relative name; -C staging .
  await runTar(['-czf', path.resolve(archivePath), '-C', path.resolve(stagingDir), '.']);

  const stat = await fsp.stat(archivePath);
  const checksum = await sha256File(archivePath);
  return {
    archivePath,
    sizeBytes: stat.size,
    checksum,
    archiveName,
    parent,
  };
}

export async function unpackArchive(archivePath, destDir) {
  await ensureEmptyDir(destDir);
  await runTar(['-xzf', path.resolve(archivePath), '-C', path.resolve(destDir)]);
}

export async function readManifest(stagingDir) {
  const file = path.join(stagingDir, 'manifest.json');
  const raw = await fsp.readFile(file, 'utf8');
  const manifest = JSON.parse(raw);
  if (manifest.format !== ARCHIVE_FORMAT) {
    throw new AppError('فرمت آرشیو بک اپ نامعتبر است', 400, 'BACKUP_INVALID');
  }
  if (manifest.version !== ARCHIVE_VERSION && manifest.version !== LEGACY_VERSION) {
    throw new AppError('نسخه فایل بک اپ پشتیبانی نمی‌شود', 400, 'BACKUP_VERSION');
  }
  return manifest;
}

export async function fileExists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Detect whether a buffer/path is a gzipped JSON legacy backup or a tar.gz archive. */
export function sniffBackupKind(bufferOrPath) {
  // If path string
  if (typeof bufferOrPath === 'string') {
    const lower = bufferOrPath.toLowerCase();
    if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz') || lower.endsWith('.apexbk')) {
      return 'archive';
    }
    if (lower.endsWith('.json.gz') || lower.endsWith('.json')) {
      return 'legacy';
    }
  }
  return null;
}

export async function sniffFileKind(filePath) {
  const fd = await fsp.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(262);
    const { bytesRead } = await fd.read(buf, 0, 262, 0);
    const slice = buf.subarray(0, bytesRead);
    // gzip magic
    if (slice[0] === 0x1f && slice[1] === 0x8b) {
      // Could be .json.gz or .tar.gz — peek after gunzip is expensive;
      // tar.gz often has ustar at offset 257 of uncompressed, but compressed we check extension / try unpack.
      // Heuristic: if gunzipped start is `{` → legacy; else archive.
      return 'gzip-unknown';
    }
    // uncompressed ustar
    if (slice.length >= 262 && slice.subarray(257, 262).toString('ascii') === 'ustar') {
      return 'archive';
    }
    if (slice[0] === 0x7b) return 'legacy'; // '{'
    return 'unknown';
  } finally {
    await fd.close();
  }
}

export { createWriteStream, createReadStream, fs, fsp, path, crypto };
