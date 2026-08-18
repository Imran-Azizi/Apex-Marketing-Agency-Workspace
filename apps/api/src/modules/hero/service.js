import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../utils/response.js";
import { writeAudit } from "../../middleware/audit.js";
import { storage } from "../../services/storage.js";

const DEFAULT_DURATION_SECONDS = 5;

export function clampDurationSeconds(value) {
  if (value == null || value === "") return DEFAULT_DURATION_SECONDS;
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_DURATION_SECONDS;
  if (n >= 1000) {
    return Math.min(10, Math.max(1, Math.round(n / 1000)));
  }
  return Math.min(10, Math.max(1, Math.round(n)));
}

const optionalText = (max, message) =>
  z
    .union([z.string().trim().max(max, message), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v ? v : null));

const durationSecondsField = z.coerce
  .number()
  .int()
  .min(1, "مدت نمایش باید بین ۱ تا ۱۰ ثانیه باشد")
  .max(10, "مدت نمایش باید بین ۱ تا ۱۰ ثانیه باشد")
  .optional()
  .nullable();

const heroSlideFields = z.object({
  title: z.string().trim().min(2, "عنوان اسلاید الزامی است").max(160),
  description: optionalText(600, "توضیحات نباید بیشتر از ۶۰۰ کاراکتر باشد"),
  imageKey: z.string().trim().min(1, "تصویر اسلاید الزامی است").max(500),
  altText: optionalText(160),
  durationSeconds: durationSecondsField,
  isPublished: z.boolean().optional().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().nullable(),
});

export const createHeroSlideSchema = heroSlideFields;

export const updateHeroSlideSchema = heroSlideFields
  .omit({ imageKey: true })
  .partial()
  .extend({
    imageKey: z
      .union([z.string().trim().max(500), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v ? v : undefined)),
  });

export const reorderHeroSlidesSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

function imageUrlFor(key) {
  if (!key) return null;
  try {
    return storage.publicUrl(key);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[hero] imageUrl resolve failed:", key, err?.message || err);
    }
    return null;
  }
}

async function tryDeleteMedia(key) {
  if (!key) return;
  try {
    await storage.deleteObject(key);
  } catch (err) {
    console.warn("[hero] media cleanup failed:", key, err?.message || err);
  }
}

export function serializeHeroSlide(row, { publicView = false } = {}) {
  if (!row) return null;
  const payload = {
    id: row.id,
    title: row.title,
    description: row.description || null,
    imageUrl: imageUrlFor(row.imageKey),
    altText: row.altText || row.title,
    durationSeconds: clampDurationSeconds(
      row.durationSeconds ?? row.durationMs,
    ),
    sortOrder: row.sortOrder ?? 0,
    isPublished: row.isPublished === true,
  };
  if (publicView) return payload;
  return {
    ...payload,
    imageKey: row.imageKey || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const heroService = {
  async list({ q, status, page = 1, pageSize = 100 } = {}) {
    const where = { deletedAt: null };
    if (status === "active" || status === "published") {
      where.isPublished = true;
    } else if (status === "inactive" || status === "draft") {
      where.isPublished = false;
    }
    if (q && String(q).trim()) {
      const term = String(q).trim();
      where.OR = [
        { title: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
      ];
    }

    const take = Math.min(100, Math.max(1, Number(pageSize) || 100));
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;
    const baseWhere = { deletedAt: null };

    const [matched, allTotal, published, rows] = await Promise.all([
      prisma.heroSlide.count({ where }),
      prisma.heroSlide.count({ where: baseWhere }),
      prisma.heroSlide.count({
        where: { ...baseWhere, isPublished: true },
      }),
      prisma.heroSlide.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        skip,
        take,
      }),
    ]);

    return {
      items: rows.map((row) => serializeHeroSlide(row)),
      total: matched,
      published,
      unpublished: Math.max(0, allTotal - published),
      page: Math.max(1, Number(page) || 1),
      pageSize: take,
    };
  },

  async listPublic() {
    const rows = await prisma.heroSlide.findMany({
      where: { isPublished: true, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return rows.map((row) => serializeHeroSlide(row, { publicView: true }));
  },

  async getById(id) {
    const row = await prisma.heroSlide.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) throw new AppError("اسلاید یافت نشد", 404, "NOT_FOUND");
    return serializeHeroSlide(row);
  },

  async create(body, auth, req) {
    const data = createHeroSlideSchema.parse(body);

    let sortOrder = data.sortOrder;
    if (sortOrder == null) {
      const latest = await prisma.heroSlide.findFirst({
        where: { deletedAt: null },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      sortOrder = (latest?.sortOrder ?? 0) + 1;
    }

    const row = await prisma.heroSlide.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        imageKey: data.imageKey,
        altText: data.altText ?? null,
        durationSeconds: data.durationSeconds ?? DEFAULT_DURATION_SECONDS,
        isPublished: data.isPublished ?? true,
        sortOrder,
      },
    });

    await writeAudit({
      userId: auth?.userId,
      action: "HERO_SLIDE_CREATE",
      entityType: "HeroSlide",
      entityId: row.id,
      after: {
        title: row.title,
        isPublished: row.isPublished,
        sortOrder: row.sortOrder,
        durationSeconds: row.durationSeconds,
      },
      req,
    });

    return serializeHeroSlide(row);
  },

  async update(id, body, auth, req) {
    const existing = await prisma.heroSlide.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new AppError("اسلاید یافت نشد", 404, "NOT_FOUND");

    const data = updateHeroSlideSchema.parse(body);

    if (data.imageKey && data.imageKey !== existing.imageKey) {
      await tryDeleteMedia(existing.imageKey);
    }

    const row = await prisma.heroSlide.update({
      where: { id },
      data: {
        ...(data.title != null ? { title: data.title } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.imageKey ? { imageKey: data.imageKey } : {}),
        ...(data.altText !== undefined ? { altText: data.altText } : {}),
        ...(data.durationSeconds != null
          ? { durationSeconds: data.durationSeconds }
          : {}),
        ...(data.isPublished != null ? { isPublished: data.isPublished } : {}),
        ...(data.sortOrder != null ? { sortOrder: data.sortOrder } : {}),
      },
    });

    await writeAudit({
      userId: auth?.userId,
      action: "HERO_SLIDE_UPDATE",
      entityType: "HeroSlide",
      entityId: row.id,
      before: {
        title: existing.title,
        isPublished: existing.isPublished,
        sortOrder: existing.sortOrder,
        imageKey: existing.imageKey,
        durationSeconds: existing.durationSeconds,
      },
      after: {
        title: row.title,
        isPublished: row.isPublished,
        sortOrder: row.sortOrder,
        imageKey: row.imageKey,
        durationSeconds: row.durationSeconds,
      },
      req,
    });

    return serializeHeroSlide(row);
  },

  async setPublished(id, isPublished, auth, req) {
    return this.update(id, { isPublished: Boolean(isPublished) }, auth, req);
  },

  async reorder(orderedIds, auth, req) {
    const ids = [...new Set(orderedIds.filter(Boolean))];
    const rows = await prisma.heroSlide.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true },
    });
    if (rows.length !== ids.length) {
      throw new AppError("برخی اسلایدها یافت نشدند", 404, "NOT_FOUND");
    }

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.heroSlide.update({
          where: { id },
          data: { sortOrder: index + 1 },
        }),
      ),
    );

    await writeAudit({
      userId: auth?.userId,
      action: "HERO_SLIDE_REORDER",
      entityType: "HeroSlide",
      entityId: null,
      after: { orderedIds: ids },
      req,
    });

    return this.list({ pageSize: 100 });
  },

  async remove(id, auth, req) {
    const existing = await prisma.heroSlide.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new AppError("اسلاید یافت نشد", 404, "NOT_FOUND");

    await prisma.heroSlide.update({
      where: { id },
      data: { deletedAt: new Date(), isPublished: false },
    });

    await tryDeleteMedia(existing.imageKey);

    await writeAudit({
      userId: auth?.userId,
      action: "HERO_SLIDE_DELETE",
      entityType: "HeroSlide",
      entityId: id,
      before: { title: existing.title, imageKey: existing.imageKey },
      req,
    });

    return { id, deleted: true };
  },
};
