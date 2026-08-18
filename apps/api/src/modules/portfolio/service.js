import path from 'path';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/response.js';
import { writeAudit } from '../../middleware/audit.js';
import { storage } from '../../services/storage.js';
import { env } from '../../config/env.js';
import {
  asMeta,
  isSentToCustomer,
  resolveVideoStatus,
  resolveVideoType,
} from '../production/finalProduct.js';
import { PORTFOLIO_PROMPT } from '../../services/ai/prompts/portfolio.prompt.js';
import {
  getModelConfig,
  resolveGenerationParams,
  resolveModelsForAgent,
} from '../../services/ai/models.config.js';
import { openRouterService } from '../../services/ai/openrouter.service.js';
import { createAiError } from '../../services/ai/errors.js';

const FINAL_KINDS = ['CLEAN_FINAL', 'WATERMARKED_FINAL'];
const ELIGIBLE_STATUSES = new Set([
  'APPROVED',
  'SENT_TO_CUSTOMER',
  'VIEWED_BY_CUSTOMER',
  'APPROVED_BY_CUSTOMER',
]);

export const publishPortfolioSchema = z.object({
  title: z.string().trim().min(3, 'عنوان حداقل ۳ کاراکتر باشد').max(120),
  description: z
    .string()
    .trim()
    .min(20, 'توضیحات حداقل ۲۰ کاراکتر باشد')
    .max(2000),
  videoFileId: z.string().min(1).optional(),
});

export const updatePortfolioSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z
    .union([z.string().trim().max(2000), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v ? v : v === '' || v === null ? null : undefined)),
  status: z.enum(['PUBLISHED', 'UNPUBLISHED']).optional(),
  videoFileId: z.string().min(1).optional(),
  storageKey: z
    .union([z.string().trim().max(500), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v ? v : v === '' || v === null ? null : undefined)),
  thumbnailKey: z
    .union([z.string().trim().max(500), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v ? v : v === '' || v === null ? null : undefined)),
  categoryIds: z.array(z.string().min(1)).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().nullable(),
});

function mediaUrlFor(key) {
  if (!key) return null;
  try {
    return storage.publicUrl(key);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[portfolio] mediaUrl resolve failed:', key, err?.message || err);
    }
    return null;
  }
}

export function slugify(input) {
  const base = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || `portfolio-${Date.now().toString(36)}`;
}

export async function uniqueSlug(base, excludeId = null) {
  let candidate = slugify(base);
  let i = 0;
  while (true) {
    const existing = await prisma.portfolioItem.findFirst({
      where: {
        slug: candidate,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    i += 1;
    candidate = `${slugify(base)}-${i}`;
  }
}

function scoreFinalFile(file, projectStatus) {
  const meta = asMeta(file.meta);
  const status = resolveVideoStatus(meta);
  const sent = isSentToCustomer(file, projectStatus);
  const type = resolveVideoType(file.kind, meta);
  let score = 0;
  if (type === 'CLEAN') score += 40;
  if (type === 'WATERMARKED') score += 10;
  if (sent) score += 30;
  if (status === 'APPROVED_BY_CUSTOMER') score += 25;
  else if (status === 'VIEWED_BY_CUSTOMER') score += 18;
  else if (status === 'SENT_TO_CUSTOMER') score += 15;
  else if (status === 'APPROVED') score += 8;
  score += Math.min(5, Number(file.version || 1));
  return score;
}

function isEligibleFinalFile(file, projectStatus) {
  if (!file || file.deletedAt) return false;
  if (!FINAL_KINDS.includes(file.kind)) return false;
  const meta = asMeta(file.meta);
  const status = resolveVideoStatus(meta);
  const sent = isSentToCustomer(file, projectStatus);
  return sent || ELIGIBLE_STATUSES.has(status);
}

function publicSafeBrief(brief) {
  if (!brief || typeof brief !== 'object') return null;
  const safe = {};
  for (const key of [
    'goal',
    'audience',
    'message',
    'styleNotes',
    'tone',
    'platforms',
    'language',
    'industry',
    'product',
    'theme',
  ]) {
    if (brief[key] != null && brief[key] !== '') safe[key] = brief[key];
  }
  return Object.keys(safe).length ? safe : null;
}

export function serializeAdminItem(item) {
  const videoType = resolveVideoType(item.videoFile?.kind, asMeta(item.videoFile?.meta));
  const categories = (item.categories || [])
    .map((row) => row.category)
    .filter((category) => category && !category.deletedAt);
  return {
    id: item.id,
    title: item.title,
    description: item.description || '',
    slug: item.slug,
    status: item.status,
    sortOrder: item.sortOrder ?? 0,
    storageKey: item.storageKey || null,
    thumbnailKey: item.thumbnailKey || null,
    thumbnailUrl: mediaUrlFor(item.thumbnailKey),
    publishedAt: item.publishedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    inMixed: Boolean(item.mixedEntry),
    mixedSortOrder: item.mixedEntry?.sortOrder ?? null,
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      isActive: category.isActive,
    })),
    project: item.project
      ? {
          id: item.project.id,
          code: item.project.code,
          title: item.project.title,
          status: item.project.status,
          completedAt: item.project.completedAt,
          serviceName: item.project.service?.name || null,
        }
      : null,
    video: item.videoFile
      ? {
          id: item.videoFile.id,
          name: item.videoFile.name,
          kind: item.videoFile.kind,
          videoType,
          mimeType: item.videoFile.mimeType,
          sizeBytes: item.videoFile.sizeBytes,
          version: item.videoFile.version,
        }
      : item.storageKey
        ? {
            id: null,
            name: item.title,
            kind: 'PORTFOLIO_UPLOAD',
            videoType: 'CLEAN',
            mimeType: 'video/mp4',
            sizeBytes: null,
            version: 1,
          }
        : null,
    publishedBy: item.publishedBy
      ? { id: item.publishedBy.id, fullName: item.publishedBy.fullName }
      : null,
  };
}

export function serializePublicItem(item) {
  const categories = (item.categories || [])
    .map((row) => row.category)
    .filter(Boolean);
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    description: item.description || null,
    publishedAt: item.publishedAt,
    thumbnailUrl: mediaUrlFor(item.thumbnailKey),
    category: categories[0]
      ? { id: categories[0].id, name: categories[0].name, slug: categories[0].slug }
      : null,
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
    })),
    video: {
      mimeType: item.videoFile?.mimeType || 'video/mp4',
      streamPath: `/public/portfolio/${item.id}/stream`,
    },
  };
}

export const itemInclude = {
  project: {
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      completedAt: true,
      service: { select: { id: true, name: true } },
    },
  },
  videoFile: {
    select: {
      id: true,
      name: true,
      kind: true,
      mimeType: true,
      sizeBytes: true,
      version: true,
      meta: true,
      storageKey: true,
      deletedAt: true,
    },
  },
  publishedBy: { select: { id: true, fullName: true } },
  mixedEntry: true,
  categories: {
    orderBy: { sortOrder: 'asc' },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          deletedAt: true,
        },
      },
    },
  },
};

async function loadProjectForPortfolio(projectId) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      completedAt: true,
      language: true,
      tone: true,
      platforms: true,
      durationSec: true,
      brief: true,
      service: { select: { id: true, name: true } },
      format: { select: { id: true, name: true } },
      files: {
        where: { kind: { in: FINAL_KINDS }, deletedAt: null },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          name: true,
          kind: true,
          mimeType: true,
          sizeBytes: true,
          version: true,
          meta: true,
          storageKey: true,
          deletedAt: true,
          createdAt: true,
        },
      },
      portfolioItems: {
        where: { deletedAt: null },
        take: 1,
        select: {
          id: true,
          title: true,
          description: true,
          slug: true,
          status: true,
          publishedAt: true,
          videoFileId: true,
        },
      },
    },
  });
  if (!project) throw new AppError('پروژه یافت نشد', 404, 'NOT_FOUND');
  return project;
}

function pickBestVideo(project, preferredFileId = null) {
  const eligible = (project.files || []).filter((file) =>
    isEligibleFinalFile(file, project.status),
  );
  if (!eligible.length) return null;
  if (preferredFileId) {
    const preferred = eligible.find((f) => f.id === preferredFileId);
    if (preferred) return preferred;
  }
  return [...eligible].sort(
    (a, b) => scoreFinalFile(b, project.status) - scoreFinalFile(a, project.status),
  )[0];
}

function assertPublishable(project) {
  if (project.status !== 'COMPLETED' || !project.completedAt) {
    throw new AppError(
      'فقط پروژه‌های تکمیل‌شده می‌توانند به نمونه‌کارها ارسال شوند',
      400,
      'PROJECT_NOT_COMPLETED',
    );
  }
  const video = pickBestVideo(project);
  if (!video) {
    throw new AppError(
      'ویدیوی نهایی واجد شرایط برای انتشار یافت نشد',
      400,
      'NO_ELIGIBLE_VIDEO',
    );
  }
  return video;
}

function parsePortfolioAiJson(raw) {
  let text = typeof raw === 'string' ? raw.trim() : '';
  if (!text && raw && typeof raw === 'object') {
    const title = String(raw.title || '').trim();
    const description = String(raw.description || '').trim();
    if (title && description) {
      return {
        title: title.slice(0, 120),
        description: description.slice(0, 2000),
      };
    }
  }
  text = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw createAiError('خروجی هوش مصنوعی نامعتبر است', {
      code: 'invalid_json',
      status: 502,
    });
  }
  const title = String(parsed?.title || '').trim();
  const description = String(parsed?.description || '').trim();
  if (title.length < 3 || description.length < 20) {
    throw createAiError('عنوان یا توضیحات تولیدشده کافی نیست', {
      code: 'invalid_portfolio_output',
      status: 502,
    });
  }
  return {
    title: title.slice(0, 120),
    description: description.slice(0, 2000),
  };
}

function mockPortfolioCopy(project) {
  const service = project.service?.name || 'ویدیوی تبلیغاتی';
  const title = `${service} حرفه‌ای`.slice(0, 120);
  const description =
    `نمونه‌کاری از تولید ${service} با رویکردی حرفه‌ای و متناسب با برند.` +
    (project.format?.name ? ` قالب ${project.format.name}.` : '') +
    (project.tone ? ` لحن ${project.tone}.` : '') +
    ' این اثر برای نمایش کیفیت تولید ویدیو در اپیکس منتشر شده است.';
  return { title, description };
}

export const portfolioService = {
  async getProjectPortfolioState(projectId) {
    const project = await loadProjectForPortfolio(projectId);
    const canPublish =
      project.status === 'COMPLETED' &&
      !!project.completedAt &&
      !!pickBestVideo(project);
    const existing = project.portfolioItems?.[0] || null;
    const videos = (project.files || [])
      .filter((file) => isEligibleFinalFile(file, project.status))
      .sort(
        (a, b) =>
          scoreFinalFile(b, project.status) - scoreFinalFile(a, project.status),
      )
      .map((file) => ({
        id: file.id,
        name: file.name,
        kind: file.kind,
        videoType: resolveVideoType(file.kind, asMeta(file.meta)),
        status: resolveVideoStatus(asMeta(file.meta)),
        version: file.version,
      }));

    return {
      project: {
        id: project.id,
        code: project.code,
        title: project.title,
        status: project.status,
        completedAt: project.completedAt,
      },
      canPublish,
      videos,
      portfolio: existing
        ? {
            id: existing.id,
            title: existing.title,
            description: existing.description,
            slug: existing.slug,
            status: existing.status,
            publishedAt: existing.publishedAt,
            videoFileId: existing.videoFileId,
          }
        : null,
    };
  },

  async generateCopy(projectId) {
    const project = await loadProjectForPortfolio(projectId);
    assertPublishable(project);

    const input = {
      projectId: project.id,
      projectTitle: project.title,
      serviceName: project.service?.name || null,
      formatName: project.format?.name || null,
      language: project.language || 'fa',
      tone: project.tone || null,
      platforms: project.platforms || null,
      durationSec: project.durationSec || null,
      brief: publicSafeBrief(project.brief),
    };

    const cfg = getModelConfig();
    if (!openRouterService.isConfigured() && cfg.allowMockFallback) {
      return mockPortfolioCopy(project);
    }
    if (!openRouterService.isConfigured()) {
      throw new AppError(
        'سرویس هوش مصنوعی پیکربندی نشده است',
        503,
        'AI_NOT_CONFIGURED',
      );
    }

    const params = resolveGenerationParams('PORTFOLIO');
    const models = resolveModelsForAgent('PORTFOLIO');
    let lastError = null;
    for (const model of models) {
      try {
        const raw = await openRouterService.completeChat({
          model,
          system: PORTFOLIO_PROMPT.system,
          userContent: input,
          temperature: params.temperature,
          maxTokens: params.maxTokens,
        });
        return parsePortfolioAiJson(raw?.text ?? raw);
      } catch (err) {
        lastError = err;
      }
    }
    if (cfg.allowMockFallback) return mockPortfolioCopy(project);
    throw new AppError(
      lastError?.messageFa || lastError?.message || 'تولید عنوان و توضیحات ناموفق بود',
      lastError?.status || 502,
      lastError?.code || 'AI_FAILED',
    );
  },

  async publishFromProject(projectId, body, actor, req) {
    const project = await loadProjectForPortfolio(projectId);
    assertPublishable(project);
    const video = pickBestVideo(project, body.videoFileId);
    if (!video) {
      throw new AppError('ویدیوی انتخاب‌شده واجد شرایط نیست', 400, 'INVALID_VIDEO');
    }

    const title = body.title.trim();
    const description = body.description.trim();
    const now = new Date();

    const existing = await prisma.portfolioItem.findFirst({
      where: { projectId, deletedAt: null },
    });

    let item;
    if (existing) {
      item = await prisma.portfolioItem.update({
        where: { id: existing.id },
        data: {
          title,
          description,
          videoFileId: video.id,
          status: 'PUBLISHED',
          publishedAt: existing.publishedAt || now,
          publishedById: actor.userId,
          slug:
            existing.status === 'PUBLISHED'
              ? existing.slug
              : await uniqueSlug(title, existing.id),
        },
        include: itemInclude,
      });
    } else {
      const softDeleted = await prisma.portfolioItem.findFirst({
        where: { projectId, deletedAt: { not: null } },
        orderBy: { updatedAt: 'desc' },
      });
      if (softDeleted) {
        item = await prisma.portfolioItem.update({
          where: { id: softDeleted.id },
          data: {
            title,
            description,
            videoFileId: video.id,
            status: 'PUBLISHED',
            publishedAt: now,
            publishedById: actor.userId,
            deletedAt: null,
            slug: await uniqueSlug(title, softDeleted.id),
          },
          include: itemInclude,
        });
      } else {
        item = await prisma.portfolioItem.create({
          data: {
            projectId,
            videoFileId: video.id,
            title,
            description,
            slug: await uniqueSlug(title),
            status: 'PUBLISHED',
            publishedAt: now,
            publishedById: actor.userId,
          },
          include: itemInclude,
        });
      }
    }

    await writeAudit({
      userId: actor.userId,
      action: existing ? 'PORTFOLIO_UPDATE' : 'PORTFOLIO_PUBLISH',
      entityType: 'PortfolioItem',
      entityId: item.id,
      before: existing
        ? { title: existing.title, description: existing.description, status: existing.status }
        : null,
      after: {
        title: item.title,
        description: item.description,
        status: item.status,
        projectId,
        videoFileId: video.id,
      },
      req,
    });

    return serializeAdminItem(item);
  },

  async listAdmin(query = {}) {
    const q = String(query.q || '').trim();
    const status = query.status && query.status !== 'ALL' ? String(query.status) : null;
    const categoryId = String(query.categoryId || '').trim() || null;
    const mixed =
      query.mixed === true || query.mixed === 'true'
        ? true
        : query.mixed === false || query.mixed === 'false'
          ? false
          : null;
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 20)));

    const where = {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(categoryId ? { categories: { some: { categoryId } } } : {}),
      ...(mixed === true ? { mixedEntry: { is: {} } } : {}),
      ...(mixed === false ? { mixedEntry: null } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
              { project: { title: { contains: q, mode: 'insensitive' } } },
              { project: { code: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const orderBy =
      mixed === true
        ? [{ mixedEntry: { sortOrder: 'asc' } }, { createdAt: 'desc' }]
        : [{ sortOrder: 'asc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }];

    const [items, total] = await Promise.all([
      prisma.portfolioItem.findMany({
        where,
        include: itemInclude,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.portfolioItem.count({ where }),
    ]);

    return {
      items: items.map(serializeAdminItem),
      total,
      page,
      pageSize,
    };
  },

  async getAdmin(id) {
    const item = await prisma.portfolioItem.findFirst({
      where: { id, deletedAt: null },
      include: itemInclude,
    });
    if (!item) throw new AppError('نمونه‌کار یافت نشد', 404, 'NOT_FOUND');
    return serializeAdminItem(item);
  },

  async update(id, body, actor, req) {
    const existing = await prisma.portfolioItem.findFirst({
      where: { id, deletedAt: null },
      include: { project: { select: { id: true, status: true } } },
    });
    if (!existing) throw new AppError('نمونه‌کار یافت نشد', 404, 'NOT_FOUND');

    const data = {};
    if (body.title != null) data.title = body.title.trim();
    if (body.description !== undefined) data.description = body.description;
    if (body.storageKey !== undefined) data.storageKey = body.storageKey;
    if (body.thumbnailKey !== undefined) data.thumbnailKey = body.thumbnailKey;
    if (body.sortOrder != null) data.sortOrder = body.sortOrder;
    if (body.status) {
      data.status = body.status;
      if (body.status === 'PUBLISHED' && !existing.publishedAt) {
        data.publishedAt = new Date();
        data.publishedById = actor.userId;
      }
    }
    if (body.videoFileId) {
      if (!existing.projectId) {
        throw new AppError('این نمونه‌کار به پروژه‌ای متصل نیست', 400, 'NO_PROJECT');
      }
      const project = await loadProjectForPortfolio(existing.projectId);
      const video = pickBestVideo(project, body.videoFileId);
      if (!video) {
        throw new AppError('ویدیوی انتخاب‌شده واجد شرایط نیست', 400, 'INVALID_VIDEO');
      }
      data.videoFileId = video.id;
    }
    if (data.title && data.title !== existing.title) {
      data.slug = await uniqueSlug(data.title, existing.id);
    }

    await prisma.portfolioItem.update({
      where: { id },
      data,
    });

    if (body.categoryIds) {
      const { syncCategoriesForItem } = await import('./showcase.js');
      await syncCategoriesForItem(id, body.categoryIds);
    }

    const item = await prisma.portfolioItem.findFirst({
      where: { id },
      include: itemInclude,
    });

    await writeAudit({
      userId: actor.userId,
      action: 'PORTFOLIO_UPDATE',
      entityType: 'PortfolioItem',
      entityId: item.id,
      before: {
        title: existing.title,
        description: existing.description,
        status: existing.status,
      },
      after: {
        title: item.title,
        description: item.description,
        status: item.status,
      },
      req,
    });

    return serializeAdminItem(item);
  },

  async remove(id, actor, req) {
    const existing = await prisma.portfolioItem.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new AppError('نمونه‌کار یافت نشد', 404, 'NOT_FOUND');

    await prisma.portfolioItem.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'UNPUBLISHED',
      },
    });

    await writeAudit({
      userId: actor.userId,
      action: 'PORTFOLIO_DELETE',
      entityType: 'PortfolioItem',
      entityId: id,
      before: {
        title: existing.title,
        projectId: existing.projectId,
        status: existing.status,
      },
      after: { deleted: true },
      req,
    });

    return { id, deleted: true };
  },

  async listPublic(query = {}) {
    const { listPublicShowcase } = await import('./showcase.js');
    return listPublicShowcase(query);
  },

  async getPublicBySlug(slug) {
    const { publicItemWhere, publicItemInclude } = await import('./showcase.js');
    let decoded = slug;
    try {
      decoded = decodeURIComponent(String(slug || ''));
    } catch {
      decoded = String(slug || '');
    }
    const item = await prisma.portfolioItem.findFirst({
      where: {
        slug: decoded,
        ...publicItemWhere,
      },
      include: publicItemInclude,
    });
    if (!item) throw new AppError('نمونه‌کار یافت نشد', 404, 'NOT_FOUND');

    const serialized = serializePublicItem(item);
    const categoryId = serialized.category?.id;
    let related = [];
    if (categoryId) {
      const rows = await prisma.portfolioItemCategory.findMany({
        where: {
          categoryId,
          itemId: { not: item.id },
          item: publicItemWhere,
        },
        orderBy: { sortOrder: 'asc' },
        take: 8,
        include: { item: { include: publicItemInclude } },
      });
      related = rows.map((row) => serializePublicItem(row.item));
    }

    return { ...serialized, related };
  },

  async getStreamTarget(id, { publishedOnly = true } = {}) {
    const item = await prisma.portfolioItem.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(publishedOnly ? { status: 'PUBLISHED' } : {}),
      },
      include: {
        videoFile: {
          select: {
            id: true,
            name: true,
            mimeType: true,
            storageKey: true,
            deletedAt: true,
          },
        },
      },
    });
    if (!item) {
      throw new AppError('ویدیوی نمونه‌کار در دسترس نیست', 404, 'NOT_FOUND');
    }
    if (item.storageKey) {
      return {
        storageKey: item.storageKey,
        mimeType: 'video/mp4',
        name: `${item.slug || 'portfolio'}.mp4`,
      };
    }
    if (!item.videoFile || item.videoFile.deletedAt || !item.videoFile.storageKey) {
      throw new AppError('ویدیوی نمونه‌کار در دسترس نیست', 404, 'NOT_FOUND');
    }
    return item.videoFile;
  },

  async getPublishedStreamTarget(id) {
    return this.getStreamTarget(id, { publishedOnly: true });
  },
};

export async function streamPortfolioVideo(req, res, file) {
  const storageKey = file.storageKey;
  const head = await storage.head(storageKey);
  const fileSize = head.size;
  const contentType =
    file.mimeType ||
    (head.contentType && head.contentType !== 'application/octet-stream'
      ? head.contentType
      : null) ||
    'video/mp4';

  // Prefer CDN redirect for Cloudinary — avoids Node proxy "terminated" errors.
  if (env.storageDriver === 'cloudinary') {
    try {
      const url =
        (await storage.createPresignedGetUrl(storageKey).catch(() => null)) ||
        storage.publicUrl(storageKey);
      if (url) {
        res.setHeader(
          'Cache-Control',
          'public, max-age=300, stale-while-revalidate=600',
        );
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.redirect(302, url);
        return;
      }
    } catch (err) {
      console.warn(
        '[portfolio-stream] CDN redirect failed, proxying:',
        err?.message || err,
      );
    }
  }

  const range = req.headers.range;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  res.setHeader('Content-Type', contentType);
  res.setHeader(
    'Content-Disposition',
    `inline; filename*=UTF-8''${encodeURIComponent(file.name || path.basename(storageKey) || 'portfolio.mp4')}`,
  );
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  const pipe = (stream) => {
    stream.on('error', (err) => {
      console.error('[portfolio-stream]', err?.message || err);
      if (!res.headersSent) {
        res.status(502).json({
          success: false,
          error: { code: 'STREAM_FAILED', message: 'خواندن ویدیو ناموفق بود' },
        });
        return;
      }
      res.destroy(err);
    });
    res.on('close', () => {
      if (!stream.destroyed) stream.destroy();
    });
    stream.pipe(res);
  };

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
      return;
    }
    const start = match[1] ? parseInt(match[1], 10) : 0;
    const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= fileSize) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
      return;
    }
    const chunkEnd = Math.min(end, fileSize - 1);
    const { stream, contentLength, contentRange } = await storage.openReadStream(
      storageKey,
      { start, end: chunkEnd },
    );
    res.status(206);
    res.setHeader(
      'Content-Range',
      contentRange || `bytes ${start}-${chunkEnd}/${fileSize}`,
    );
    res.setHeader('Content-Length', contentLength ?? chunkEnd - start + 1);
    pipe(stream);
    return;
  }

  const { stream, contentLength } = await storage.openReadStream(storageKey);
  res.setHeader('Content-Length', contentLength ?? fileSize);
  pipe(stream);
}
