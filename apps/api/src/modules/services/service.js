import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../utils/response.js";
import { writeAudit } from "../../middleware/audit.js";
import { storage } from "../../services/storage.js";

export const createServiceSchema = z.object({
  name: z.string().trim().min(2, "عنوان خدمت الزامی است").max(200),
  slug: z
    .union([
      z
        .string()
        .trim()
        .max(120)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "اسلاگ باید لاتین و با خط تیره باشد"),
      z.literal(""),
      z.null(),
    ])
    .optional()
    .transform((v) => (v ? v : null)),
  description: z
    .union([z.string().trim().max(2000), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
  imageKey: z
    .union([z.string().trim().max(500), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
  startingPrice: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v == null || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }),
  isPublished: z.boolean().optional().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().nullable(),
});

export const updateServiceSchema = createServiceSchema.partial();

export const reorderServicesSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

function latinSlugify(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function uniqueSlug(base, excludeId = null) {
  let candidate = latinSlugify(base) || `service-${Date.now().toString(36)}`;
  let attempt = 0;
  while (attempt < 50) {
    const existing = await prisma.service.findFirst({
      where: {
        slug: candidate,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    attempt += 1;
    candidate = `${latinSlugify(base) || "service"}-${attempt + 1}`;
  }
  return `service-${Date.now().toString(36)}`;
}

function imageUrlFor(key) {
  if (!key) return null;
  try {
    return storage.publicUrl(key);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[services] imageUrl resolve failed:", key, err?.message || err);
    }
    return null;
  }
}

export function serializeService(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    title: row.name,
    slug: row.slug,
    description: row.description,
    imageKey: row.imageKey || null,
    imageUrl: imageUrlFor(row.imageKey),
    startingPrice:
      row.startingPrice != null ? String(row.startingPrice) : null,
    revisionCount: row.revisionCount ?? 2,
    isPublished: row.isPublished === true,
    isActive: row.isPublished === true,
    sortOrder: row.sortOrder ?? 0,
    displayOrder: row.sortOrder ?? 0,
    ctaLabel: row.ctaLabel || null,
    ctaHref: row.ctaHref || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const servicesService = {
  async list({ q, status, page = 1, pageSize = 50 } = {}) {
    const where = { deletedAt: null };
    if (status === "active" || status === "published") {
      where.isPublished = true;
    } else if (status === "inactive" || status === "draft") {
      where.isPublished = false;
    }
    if (q && String(q).trim()) {
      const term = String(q).trim();
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { slug: { contains: term, mode: "insensitive" } },
      ];
    }

    const take = Math.min(100, Math.max(1, Number(pageSize) || 50));
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;

    const [total, rows] = await Promise.all([
      prisma.service.count({ where }),
      prisma.service.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        skip,
        take,
      }),
    ]);

    return {
      items: rows.map(serializeService),
      total,
      page: Math.max(1, Number(page) || 1),
      pageSize: take,
    };
  },

  async listPublic() {
    const rows = await prisma.service.findMany({
      where: { isPublished: true, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return rows.map((row) => {
      const { revisionCount: _revisionCount, ...item } = serializeService(row);
      return item;
    });
  },

  async getById(id) {
    const row = await prisma.service.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) throw new AppError("خدمت یافت نشد", 404, "NOT_FOUND");
    return serializeService(row);
  },

  async create(body, auth, req) {
    const data = createServiceSchema.parse(body);
    const slug = await uniqueSlug(data.slug || data.name);

    let sortOrder = data.sortOrder;
    if (sortOrder == null) {
      const latest = await prisma.service.findFirst({
        where: { deletedAt: null },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      sortOrder = (latest?.sortOrder ?? 0) + 1;
    }

    const row = await prisma.service.create({
      data: {
        name: data.name,
        slug,
        description: data.description ?? null,
        imageKey: data.imageKey ?? null,
        startingPrice: data.startingPrice,
        isPublished: data.isPublished ?? true,
        sortOrder,
      },
    });

    await writeAudit({
      userId: auth?.userId,
      action: "SERVICE_CREATE",
      entityType: "Service",
      entityId: row.id,
      after: { name: row.name, slug: row.slug, isPublished: row.isPublished },
      req,
    });

    return serializeService(row);
  },

  async update(id, body, auth, req) {
    const existing = await prisma.service.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new AppError("خدمت یافت نشد", 404, "NOT_FOUND");

    const data = updateServiceSchema.parse(body);
    const nextSlug =
      data.slug != null
        ? await uniqueSlug(data.slug || data.name || existing.name, id)
        : undefined;

    const row = await prisma.service.update({
      where: { id },
      data: {
        ...(data.name != null ? { name: data.name } : {}),
        ...(nextSlug != null ? { slug: nextSlug } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.imageKey !== undefined ? { imageKey: data.imageKey } : {}),
        ...(data.startingPrice !== undefined
          ? { startingPrice: data.startingPrice }
          : {}),
        ...(data.isPublished != null ? { isPublished: data.isPublished } : {}),
        ...(data.sortOrder != null ? { sortOrder: data.sortOrder } : {}),
      },
    });

    await writeAudit({
      userId: auth?.userId,
      action: "SERVICE_UPDATE",
      entityType: "Service",
      entityId: row.id,
      before: {
        name: existing.name,
        isPublished: existing.isPublished,
        sortOrder: existing.sortOrder,
      },
      after: {
        name: row.name,
        isPublished: row.isPublished,
        sortOrder: row.sortOrder,
        imageKey: row.imageKey,
      },
      req,
    });

    return serializeService(row);
  },

  async setPublished(id, isPublished, auth, req) {
    return this.update(id, { isPublished: Boolean(isPublished) }, auth, req);
  },

  async reorder(orderedIds, auth, req) {
    const ids = [...new Set(orderedIds.filter(Boolean))];
    const rows = await prisma.service.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true },
    });
    if (rows.length !== ids.length) {
      throw new AppError("برخی خدمات یافت نشدند", 404, "NOT_FOUND");
    }

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.service.update({
          where: { id },
          data: { sortOrder: index + 1 },
        }),
      ),
    );

    await writeAudit({
      userId: auth?.userId,
      action: "SERVICE_REORDER",
      entityType: "Service",
      entityId: null,
      after: { orderedIds: ids },
      req,
    });

    return this.list({ pageSize: 100 });
  },

  async remove(id, auth, req) {
    const existing = await prisma.service.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new AppError("خدمت یافت نشد", 404, "NOT_FOUND");

    await prisma.service.update({
      where: { id },
      data: { deletedAt: new Date(), isPublished: false },
    });

    await writeAudit({
      userId: auth?.userId,
      action: "SERVICE_DELETE",
      entityType: "Service",
      entityId: id,
      before: { name: existing.name, slug: existing.slug },
      req,
    });

    return { id, deleted: true };
  },
};
