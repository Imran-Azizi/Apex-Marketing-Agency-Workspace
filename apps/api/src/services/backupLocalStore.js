/**
 * Local durable store for system backups.
 * Cloudinary often blocks unsigned/signed delivery of raw archives (.gz),
 * so backups are always written here first for reliable download/restore.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createReadStream, existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** apps/api/var/backups */
export const BACKUP_ROOT = path.resolve(__dirname, '../../var/backups');

function safeName(name) {
  return String(name || 'backup.bin').replace(/[^a-zA-Z0-9._-]+/g, '_');
}

export function localBackupPath(backupId, fileName) {
  return path.join(BACKUP_ROOT, String(backupId), safeName(fileName));
}

export async function ensureBackupRoot() {
  await fs.mkdir(BACKUP_ROOT, { recursive: true });
}

export async function saveLocalBackup(backupId, fileName, buffer) {
  await ensureBackupRoot();
  const dir = path.join(BACKUP_ROOT, String(backupId));
  await fs.mkdir(dir, { recursive: true });
  const fullPath = localBackupPath(backupId, fileName);
  await fs.writeFile(fullPath, buffer);
  return fullPath;
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
}
