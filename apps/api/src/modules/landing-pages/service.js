import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../utils/response.js";
import { writeAudit } from "../../middleware/audit.js";
import { storage } from "../../services/storage.js";
import { afterPublicLandingPagesMutation } from "./public-invalidate.js";
import {
  assertValidSlug,
  contentsEqual,
  defaultLandingContent,
  hasPublishableContent,
  hydrateContentUrls,
  sanitizeLandingContent,
  slugify,
} from "./content.js";

const optionalText = (max, message) =>
  z
    .union([z.string().trim().max(max, message), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v ? v : null));

export const createLandingPageSchema = z.object({
  title: z.string().trim().min(2, "عنوان صفحه الزامی است").max(160),
  slug: z.string().trim().max(80).optional().nullable(),
  description: optionalText(500, "توضیحات داخلی نباید بیشتر از ۵۰۰ کاراکتر باشد"),
});

export const updateLandingPageSchema = z.object({
  title: z.string().trim().min(2, "عنوان صفحه الزامی است").max(160).optional(),
  slug: z.string().trim().max(80).optional(),
  description: optionalText(500, "توضیحات داخلی نباید بیشتر از ۵۰۰ کاراکتر باشد"),
  content: z.any().optional(),
});

function mediaUrlFor(key) {
  if (!key) return null;
  try {
    return storage.publicUrl(key);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[landing-pages] mediaUrl resolve failed:", key, err?.message || err);
    }
    return null;
  }
}

function hydrate(content) {
  return hydrateContentUrls(content, mediaUrlFor);
}

async function uniqueSlugOrThrow(desired, { excludeId } = {}) {
  const checked = assertValidSlug(desired);
  if (!checked.ok) {
    throw new AppError(checked.message, 400, "INVALID_SLUG");
  }
  const existing = await prisma.landingPage.findFirst({
    where: {
      slug: checked.slug,
      deletedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new AppError("این نامک قبلاً استفاده شده است", 409, "DUPLICATE_SLUG");
  }
  return checked.slug;
}

async function nextCopySlug(base) {
  const root = slugify(base) || "landing-page";
  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? `${root}-copy` : `${root}-copy-${i + 1}`;
    const checked = assertValidSlug(candidate);
    if (!checked.ok) continue;
    const existing = await prisma.landingPage.findFirst({
      where: { slug: checked.slug, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return checked.slug;
  }
  return `${root}-copy-${Date.now().toString(36)}`;
}

function hasUnpublishedChanges(row) {
  if (!row.isPublished) return false;
  return !contentsEqual(row.draftContent, row.publishedContent);
}

export function serializeLandingPage(row, { publicView = false } = {}) {
  if (!row) return null;
  if (publicView) {
    const content = hydrate(sanitizeLandingContent(row.publishedContent, { title: row.title }));
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      description: row.description || null,
      content,
      publishedAt: row.publishedAt,
    };
  }

  const draft = hydrate(sanitizeLandingContent(row.draftContent, { title: row.title }));
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description || null,
    content: draft,
    status: row.status,
    isPublished: row.isPublished === true,
    publishedAt: row.publishedAt,
    hasUnpublishedChanges: hasUnpublishedChanges(row),
    createdById: row.createdById || null,
    updatedById: row.updatedById || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function serializeLandingPageSummary(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description || null,
    status: row.status,
    isPublished: row.isPublished === true,
    publishedAt: row.publishedAt,
    hasUnpublishedChanges: hasUnpublishedChanges(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function findActive(id) {
  const row = await prisma.landingPage.findFirst({
    where: { id, deletedAt: null },
  });
  if (!row) throw new AppError("صفحه لندنگ یافت نشد", 404, "NOT_FOUND");
  return row;
}

export const landingPagesService = {
  async list({ q, status, page = 1, pageSize = 50 } = {}) {
    const where = { deletedAt: null };
    if (status === "published") {
      where.isPublished = true;
    } else if (status === "draft") {
      where.isPublished = false;
    }
    if (q && String(q).trim()) {
      const term = String(q).trim();
      where.OR = [
        { title: { contains: term, mode: "insensitive" } },
        { slug: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
      ];
    }

    const take = Math.min(100, Math.max(1, Number(pageSize) || 50));
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;
    const baseWhere = { deletedAt: null };

    const [matched, allTotal, published, rows] = await Promise.all([
      prisma.landingPage.count({ where }),
      prisma.landingPage.count({ where: baseWhere }),
      prisma.landingPage.count({
        where: { ...baseWhere, isPublished: true },
      }),
      prisma.landingPage.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        skip,
        take,
      }),
    ]);

    return {
      items: rows.map(serializeLandingPageSummary),
      total: matched,
      published,
      unpublished: Math.max(0, allTotal - published),
      page: Math.max(1, Number(page) || 1),
      pageSize: take,
    };
  },

  async getById(id) {
    const row = await findActive(id);
    return serializeLandingPage(row);
  },

  async getPublicBySlug(slug) {
    let decoded = String(slug || "");
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      decoded = String(slug || "");
    }
    const checked = assertValidSlug(decoded);
    if (!checked.ok) {
      throw new AppError("صفحه لندنگ یافت نشد", 404, "NOT_FOUND");
    }
    const row = await prisma.landingPage.findFirst({
      where: {
        slug: checked.slug,
        deletedAt: null,
        isPublished: true,
        status: "PUBLISHED",
      },
    });
    if (!row || !row.publishedContent) {
      throw new AppError("صفحه لندنگ یافت نشد", 404, "NOT_FOUND");
    }
    return serializeLandingPage(row, { publicView: true });
  },

  async create(body, auth, req) {
    const data = createLandingPageSchema.parse(body);
    const desired = data.slug?.trim() ? data.slug : slugify(data.title);
    const slug = await uniqueSlugOrThrow(desired);
    const draftContent = sanitizeLandingContent(defaultLandingContent(data.title), {
      title: data.title,
    });

    const row = await prisma.landingPage.create({
      data: {
        title: data.title,
        slug,
        description: data.description ?? null,
        draftContent,
        status: "DRAFT",
        isPublished: false,
        createdById: auth?.userId || null,
        updatedById: auth?.userId || null,
      },
    });

    await writeAudit({
      userId: auth?.userId,
      action: "LANDING_PAGE_CREATE",
      entityType: "LandingPage",
      entityId: row.id,
      after: { title: row.title, slug: row.slug, status: row.status },
      req,
    });

    return serializeLandingPage(row);
  },

  async update(id, body, auth, req) {
    const existing = await findActive(id);
    const data = updateLandingPageSchema.parse(body);

    let nextSlug = existing.slug;
    if (data.slug != null && slugify(data.slug) !== existing.slug) {
      nextSlug = await uniqueSlugOrThrow(data.slug, { excludeId: id });
    }

    const nextDraft =
      data.content !== undefined
        ? sanitizeLandingContent(data.content, {
            title: data.title ?? existing.title,
          })
        : existing.draftContent;

    const row = await prisma.landingPage.update({
      where: { id },
      data: {
        ...(data.title != null ? { title: data.title } : {}),
        slug: nextSlug,
        ...(data.description !== undefined ? { description: data.description } : {}),
        draftContent: nextDraft,
        updatedById: auth?.userId || null,
      },
    });

    await writeAudit({
      userId: auth?.userId,
      action: "LANDING_PAGE_UPDATE",
      entityType: "LandingPage",
      entityId: row.id,
      before: { title: existing.title, slug: existing.slug },
      after: { title: row.title, slug: row.slug },
      req,
    });

    return serializeLandingPage(row);
  },

  async duplicate(id, auth, req) {
    const existing = await findActive(id);
    const slug = await nextCopySlug(existing.slug);
    const title = `${existing.title} (کپی)`.slice(0, 160);
    const draftContent = sanitizeLandingContent(existing.draftContent, {
      title,
    });

    const row = await prisma.landingPage.create({
      data: {
        title,
        slug,
        description: existing.description,
        draftContent,
        status: "DRAFT",
        isPublished: false,
        createdById: auth?.userId || null,
        updatedById: auth?.userId || null,
      },
    });

    await writeAudit({
      userId: auth?.userId,
      action: "LANDING_PAGE_DUPLICATE",
      entityType: "LandingPage",
      entityId: row.id,
      after: { fromId: existing.id, title: row.title, slug: row.slug },
      req,
    });

    return serializeLandingPage(row);
  },

  async publish(id, auth, req) {
    const existing = await findActive(id);
    const draft = sanitizeLandingContent(existing.draftContent, {
      title: existing.title,
    });
    const slugCheck = assertValidSlug(existing.slug);
    if (!slugCheck.ok) {
      throw new AppError(slugCheck.message, 400, "INVALID_SLUG");
    }
    if (!String(existing.title || "").trim()) {
      throw new AppError("عنوان صفحه الزامی است", 400, "INVALID_TITLE");
    }
    if (!hasPublishableContent(draft)) {
      throw new AppError(
        "برای انتشار، بنر یا حداقل یک بخش محتوا لازم است",
        400,
        "INVALID_CONTENT",
      );
    }

    const row = await prisma.landingPage.update({
      where: { id },
      data: {
        draftContent: draft,
        publishedContent: draft,
        status: "PUBLISHED",
        isPublished: true,
        publishedAt: new Date(),
        updatedById: auth?.userId || null,
      },
    });

    await writeAudit({
      userId: auth?.userId,
      action: "LANDING_PAGE_PUBLISH",
      entityType: "LandingPage",
      entityId: row.id,
      after: { slug: row.slug, publishedAt: row.publishedAt },
      req,
    });

    await afterPublicLandingPagesMutation({ slug: row.slug });
    return serializeLandingPage(row);
  },

  async unpublish(id, auth, req) {
    const existing = await findActive(id);
    const row = await prisma.landingPage.update({
      where: { id },
      data: {
        status: "DRAFT",
        isPublished: false,
        updatedById: auth?.userId || null,
      },
    });

    await writeAudit({
      userId: auth?.userId,
      action: "LANDING_PAGE_UNPUBLISH",
      entityType: "LandingPage",
      entityId: row.id,
      before: { slug: existing.slug, isPublished: existing.isPublished },
      after: { slug: row.slug, isPublished: false },
      req,
    });

    await afterPublicLandingPagesMutation({ slug: existing.slug });
    return serializeLandingPage(row);
  },

  async remove(id, auth, req) {
    const existing = await findActive(id);
    const freedSlug = `${existing.slug}__deleted__${existing.id}`.slice(0, 120);
    await prisma.landingPage.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        slug: freedSlug,
        isPublished: false,
        status: "DRAFT",
        updatedById: auth?.userId || null,
      },
    });

    await writeAudit({
      userId: auth?.userId,
      action: "LANDING_PAGE_DELETE",
      entityType: "LandingPage",
      entityId: id,
      before: { title: existing.title, slug: existing.slug },
      req,
    });

    if (existing.isPublished) {
      await afterPublicLandingPagesMutation({ slug: existing.slug });
    }
    return { id, deleted: true };
  },
};
