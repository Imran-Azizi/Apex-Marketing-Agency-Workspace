import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../middleware/auth.js';
import { requireInternal, requirePermission } from '../../middleware/rbac.js';
import { requireCsrf } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { parsePagination } from '../../utils/pagination.js';
import { ok, created, AppError } from '../../utils/response.js';
import { KNOWLEDGE_ATTACHMENT_MAX_BYTES } from './constants.js';
import {
  knowledgeService,
  createKnowledgeSchema,
  updateKnowledgeSchema,
} from './service.js';

const router = Router();
router.use(requireAuth, requireInternal);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: KNOWLEDGE_ATTACHMENT_MAX_BYTES, files: 1 },
});

function handleMulter(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('حجم فایل بیش از حد مجاز است', 400, 'FILE_TOO_LARGE'));
      }
      return next(new AppError(err.message || 'خطای آپلود', 400, 'UPLOAD_ERROR'));
    }
    if (err) return next(err);
    next();
  });
}

router.get('/meta', requirePermission('knowledge.view'), async (req, res, next) => {
  try {
    ok(res, knowledgeService.meta());
  } catch (e) {
    next(e);
  }
});

router.get('/stats', requirePermission('knowledge.view'), async (req, res, next) => {
  try {
    ok(res, await knowledgeService.stats(req.auth, { kind: req.query.kind }));
  } catch (e) {
    next(e);
  }
});

router.get('/', requirePermission('knowledge.view'), async (req, res, next) => {
  try {
    const { page, pageSize } = parsePagination(req.query, { defaultPageSize: 12 });
    ok(
      res,
      await knowledgeService.list(req.auth, {
        q: req.query.q,
        status: req.query.status,
        category: req.query.category,
        kind: req.query.kind,
        mine: req.query.mine,
        page,
        pageSize,
      }),
      { page },
    );
  } catch (e) {
    next(e);
  }
});

router.get('/:id', requirePermission('knowledge.view'), async (req, res, next) => {
  try {
    ok(res, await knowledgeService.getById(req.auth, req.params.id));
  } catch (e) {
    next(e);
  }
});

router.post(
  '/',
  requireCsrf,
  requirePermission('knowledge.create', 'knowledge.manage'),
  validate(createKnowledgeSchema),
  async (req, res, next) => {
    try {
      created(res, await knowledgeService.create(req.auth, req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  '/:id',
  requireCsrf,
  requirePermission('knowledge.edit', 'knowledge.create', 'knowledge.manage'),
  validate(updateKnowledgeSchema),
  async (req, res, next) => {
    try {
      ok(res, await knowledgeService.update(req.auth, req.params.id, req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/:id/publish',
  requireCsrf,
  requirePermission('knowledge.edit', 'knowledge.create', 'knowledge.manage'),
  async (req, res, next) => {
    try {
      ok(res, await knowledgeService.publish(req.auth, req.params.id));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/:id/archive',
  requireCsrf,
  requirePermission('knowledge.edit', 'knowledge.create', 'knowledge.manage'),
  async (req, res, next) => {
    try {
      ok(res, await knowledgeService.archive(req.auth, req.params.id));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/:id/attachments',
  requireCsrf,
  requirePermission('knowledge.edit', 'knowledge.create', 'knowledge.manage'),
  handleMulter,
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw new AppError('فایل الزامی است', 400, 'FILE_REQUIRED');
      }
      created(res, await knowledgeService.addAttachment(req.auth, req.params.id, req.file));
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  '/:id/attachments/:attachmentId',
  requireCsrf,
  requirePermission('knowledge.edit', 'knowledge.create', 'knowledge.manage'),
  async (req, res, next) => {
    try {
      ok(
        res,
        await knowledgeService.removeAttachment(
          req.auth,
          req.params.id,
          req.params.attachmentId,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  '/:id',
  requireCsrf,
  requirePermission('knowledge.delete', 'knowledge.edit', 'knowledge.manage'),
  async (req, res, next) => {
    try {
      ok(res, await knowledgeService.softDelete(req.auth, req.params.id));
    } catch (e) {
      next(e);
    }
  },
);

export default router;
