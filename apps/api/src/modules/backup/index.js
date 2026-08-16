import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { requireInternal, requirePermission } from '../../middleware/rbac.js';
import { requireCsrf } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { ok, created, AppError } from '../../utils/response.js';
import {
  backupService,
  getScheduleSettings,
  saveScheduleSettings,
} from './service.js';

const upload = multer({
  storage: multer.memoryStorage(),
});

function acceptBackupUpload(req, res, next) {
  req.setTimeout(15 * 60 * 1000);
  res.setTimeout(15 * 60 * 1000);
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof AppError) return next(err);
    if (err instanceof multer.MulterError) {
      return next(
        new AppError(err.message || 'آپلود فایل پشتیبان ناموفق بود', 400, 'UPLOAD_FAILED'),
      );
    }
    return next(err);
  });
}

const scheduleSchema = z.object({
  emailTo: z.union([z.string().email(), z.literal('')]).optional(),
  daily: z
    .object({
      enabled: z.boolean(),
      time: z.string().regex(/^\d{2}:\d{2}$/),
    })
    .optional(),
  weekly: z
    .object({
      enabled: z.boolean(),
      dayOfWeek: z.number().int().min(0).max(6),
      time: z.string().regex(/^\d{2}:\d{2}$/),
    })
    .optional(),
  monthly: z
    .object({
      enabled: z.boolean(),
      dayOfMonth: z.number().int().min(1).max(28),
      time: z.string().regex(/^\d{2}:\d{2}$/),
    })
    .optional(),
});

const router = Router();
router.use(requireAuth, requireInternal);

router.get('/overview', requirePermission('backup.view'), async (req, res, next) => {
  try {
    ok(res, await backupService.overview());
  } catch (e) {
    next(e);
  }
});

router.get('/', requirePermission('backup.view'), async (req, res, next) => {
  try {
    ok(res, await backupService.list(req.query));
  } catch (e) {
    next(e);
  }
});

router.get('/schedule', requirePermission('backup.view'), async (req, res, next) => {
  try {
    const schedule = await getScheduleSettings();
    ok(res, {
      schedule,
      nextRuns: backupService.computeNextRuns(schedule),
    });
  } catch (e) {
    next(e);
  }
});

router.put('/schedule', requireCsrf, requirePermission('backup.manage'), validate(scheduleSchema), async (req, res, next) => {
  try {
    const schedule = await saveScheduleSettings(req.body, req.auth, req);
    ok(res, {
      schedule,
      nextRuns: backupService.computeNextRuns(schedule),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/', requireCsrf, requirePermission('backup.create'), async (req, res, next) => {
  try {
    created(
      res,
      await backupService.create({
        type: 'MANUAL',
        auth: req.auth,
        req,
      }),
    );
  } catch (e) {
    next(e);
  }
});

router.get('/:id', requirePermission('backup.view'), async (req, res, next) => {
  try {
    ok(res, await backupService.get(req.params.id));
  } catch (e) {
    next(e);
  }
});

router.get('/:id/download', requirePermission('backup.download'), async (req, res, next) => {
  try {
    const { stream, fileName, sizeBytes, backup } =
      await backupService.openDownloadStream(req.params.id);

    await backupService.download(backup.id, req.auth, req);

    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(fileName || 'apex-backup.json.gz')}"`,
    );
    if (sizeBytes) {
      res.setHeader('Content-Length', String(sizeBytes));
    }

    stream.on('error', (err) => {
      console.error('[backup] download stream error:', err?.message || err);
      if (!res.headersSent) {
        next(new AppError('خطا در دریافت فایل پشتیبان', 502, 'BACKUP_STREAM'));
      } else {
        res.destroy(err);
      }
    });
    stream.pipe(res);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requireCsrf, requirePermission('backup.delete'), async (req, res, next) => {
  try {
    ok(res, await backupService.delete(req.params.id, req.auth, req));
  } catch (e) {
    next(e);
  }
});

router.post('/:id/restore', requireCsrf, requirePermission('backup.restore'), async (req, res, next) => {
  try {
    ok(
      res,
      await backupService.restoreFromBackupId(req.params.id, req.body || {}, req.auth, req),
    );
  } catch (e) {
    next(e);
  }
});

router.post(
  '/validate-upload',
  requireCsrf,
  requirePermission('backup.restore'),
  acceptBackupUpload,
  async (req, res, next) => {
    try {
      if (!req.file?.buffer) {
        throw new AppError('فایل پشتیبان الزامی است', 400, 'FILE_REQUIRED');
      }
      ok(res, backupService.validateUploadBuffer(req.file.buffer));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/restore-upload',
  requireCsrf,
  requirePermission('backup.restore'),
  acceptBackupUpload,
  async (req, res, next) => {
    try {
      if (!req.file?.buffer) {
        throw new AppError('فایل پشتیبان الزامی است', 400, 'FILE_REQUIRED');
      }
      ok(
        res,
        await backupService.restoreFromBuffer(req.file.buffer, {
          confirm: req.body?.confirm,
          auth: req.auth,
          req,
        }),
      );
    } catch (e) {
      next(e);
    }
  },
);

export default router;
