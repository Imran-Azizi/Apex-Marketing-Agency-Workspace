import path from 'path';
import crypto from 'crypto';
import {
  KNOWLEDGE_ALLOWED_DOC_MIMES,
  KNOWLEDGE_ALLOWED_IMAGE_MIMES,
  KNOWLEDGE_ALLOWED_VIDEO_MIMES,
  KNOWLEDGE_ATTACHMENT_MAX_BYTES,
} from './constants.js';
import { AppError } from '../../utils/response.js';
import { storage } from '../../services/storage.js';
import {
  MEDIA_ROOTS,
  UPLOAD_PURPOSE,
  sanitizeFilename,
  sanitizePathSegment,
} from '../../services/storage/media-manager.js';

function extFromName(name) {
  const ext = path.extname(String(name || '')).toLowerCase();
  if (!ext || ext.length > 10) return '';
  if (!/^\.[a-z0-9.]+$/i.test(ext)) return '';
  return ext;
}

function sniffKind(mime) {
  const m = String(mime || '').toLowerCase();
  if (KNOWLEDGE_ALLOWED_IMAGE_MIMES.has(m) || m.startsWith('image/')) return 'IMAGE';
  if (KNOWLEDGE_ALLOWED_VIDEO_MIMES.has(m) || m.startsWith('video/')) return 'VIDEO';
  if (KNOWLEDGE_ALLOWED_DOC_MIMES.has(m)) return 'DOCUMENT';
  return 'OTHER';
}

export function validateKnowledgeUpload(file) {
  if (!file?.buffer?.length) {
    throw new AppError('فایل خالی است', 400, 'EMPTY_FILE');
  }

  const sizeBytes = file.buffer.length;
  if (sizeBytes > KNOWLEDGE_ATTACHMENT_MAX_BYTES) {
    throw new AppError('حجم فایل بیش از حد مجاز است', 400, 'FILE_TOO_LARGE');
  }

  let mimeType = String(file.mimetype || '').toLowerCase();
  const buf = file.buffer;
  if (buf[0] === 0xff && buf[1] === 0xd8) mimeType = 'image/jpeg';
  else if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    mimeType = 'image/png';
  } else if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    mimeType = 'application/pdf';
  } else if (buf.length > 8 && buf.toString('ascii', 4, 8) === 'ftyp') {
    mimeType = mimeType.startsWith('video/') ? mimeType : 'video/mp4';
  }

  const kind = sniffKind(mimeType);
  const allowed =
    KNOWLEDGE_ALLOWED_IMAGE_MIMES.has(mimeType) ||
    KNOWLEDGE_ALLOWED_VIDEO_MIMES.has(mimeType) ||
    KNOWLEDGE_ALLOWED_DOC_MIMES.has(mimeType) ||
    mimeType.startsWith('image/') ||
    mimeType.startsWith('video/');

  if (!allowed || kind === 'OTHER') {
    throw new AppError('نوع فایل مجاز نیست', 400, 'FILE_TYPE_NOT_ALLOWED');
  }

  const rawName = sanitizeFilename(file.originalname).slice(0, 120) || 'file';
  const ext = extFromName(rawName) || extFromName(`.${mimeType.split('/')[1] || 'bin'}`);
  const fileName = rawName.includes('.') ? rawName : `${rawName}${ext}`;

  return { mimeType, kind, fileName, sizeBytes };
}

export async function saveKnowledgeAttachment(file, { entryId, userId }) {
  const validated = validateKnowledgeUpload(file);
  const entry = sanitizePathSegment(entryId) || 'draft';
  const uid = sanitizePathSegment(userId) || 'user';

  const folderPath = `${MEDIA_ROOTS.DOCUMENTS}/knowledge/${entry}/${uid}`;
  const keySuffix = crypto.randomBytes(16).toString('hex');
  const ext = extFromName(validated.fileName) || '';
  const safeName = `${keySuffix}${ext}`;
  const storageKeyExplicit = `${folderPath}/${safeName}`;

  const saved = await storage.saveBuffer(file.buffer, {
    filename: safeName,
    contentType: validated.mimeType,
    storageKey: storageKeyExplicit,
    uploadContext: {
      purpose: UPLOAD_PURPOSE.KNOWLEDGE_ATTACHMENT,
      entryId: entry,
      userId: uid,
    },
  });

  const storageKey = saved?.key || saved?.storageKey || storageKeyExplicit;

  return {
    storageKey,
    fileName: validated.fileName,
    mimeType: validated.mimeType,
    sizeBytes: validated.sizeBytes,
    kind: validated.kind,
    meta: {
      storage: {
        url: saved?.url || saved?.cdnUrl || null,
        key: storageKey,
        contentType: validated.mimeType,
        size: validated.sizeBytes,
      },
    },
  };
}
