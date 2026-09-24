/**
 * Local durable store for system backups.
 * Archives are written here first for reliable download/restore; cloud mirror is optional.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createReadStream, createWriteStream, existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** apps/api/var/backups */
export const BACKUP_ROOT = path.resolve(__dirname, '../../var/backups');
/** Staging + upload temp under the same root */
export const BACKUP_STAGING_ROOT = path.join(BACKUP_ROOT, '_staging');
export const BACKUP_UPLOAD_ROOT = path.join(BACKUP_ROOT, '_uploads');

function safeName(name) {
  return String(name || 'backup.bin').replace(/[^a-zA-Z0-9._-]+/g, '_');
}

export function localBackupPath(backupId, fileName) {
  return path.join(BACKUP_ROOT, String(backupId), safeName(fileName));
}

export function stagingDirFor(backupId) {
  return path.join(BACKUP_STAGING_ROOT, String(backupId));
}

export async function ensureBackupRoot() {
  await fs.mkdir(BACKUP_ROOT, { recursive: true });
  await fs.mkdir(BACKUP_STAGING_ROOT, { recursive: true });
  await fs.mkdir(BACKUP_UPLOAD_ROOT, { recursive: true });
}

export async function saveLocalBackup(backupId, fileName, buffer) {
  await ensureBackupRoot();
  const dir = path.join(BACKUP_ROOT, String(backupId));
  await fs.mkdir(dir, { recursive: true });
  const fullPath = localBackupPath(backupId, fileName);
  await fs.writeFile(fullPath, buffer);
  return fullPath;
}

/** Move a completed archive file into the durable backup folder. */
export async function moveIntoLocalBackup(backupId, fileName, sourcePath) {
  await ensureBackupRoot();
  const dir = path.join(BACKUP_ROOT, String(backupId));
  await fs.mkdir(dir, { recursive: true });
  const dest = localBackupPath(backupId, fileName);
  try {
    await fs.rename(sourcePath, dest);
  } catch {
    await fs.copyFile(sourcePath, dest);
    await fs.unlink(sourcePath).catch(() => {});
  }
  return dest;
}

export async function localBackupExists(backupId, fileName) {
  if (!backupId || !fileName) return false;
  try {
    await fs.access(localBackupPath(backupId, fileName));
    return true;
  } catch {
    return false;
  }
}

export async function readLocalBackup(backupId, fileName) {
  const fullPath = localBackupPath(backupId, fileName);
  return fs.readFile(fullPath);
}

export function openLocalBackupStream(backupId, fileName) {
  const fullPath = localBackupPath(backupId, fileName);
  if (!existsSync(fullPath)) return null;
  return createReadStream(fullPath);
}

export async function deleteLocalBackup(backupId) {
  if (!backupId) return;
  const dir = path.join(BACKUP_ROOT, String(backupId));
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  try {
    await fs.rm(stagingDirFor(backupId), { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

export async function clearStaging(backupId) {
  try {
    await fs.rm(stagingDirFor(backupId), { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

export { createWriteStream, createReadStream };
