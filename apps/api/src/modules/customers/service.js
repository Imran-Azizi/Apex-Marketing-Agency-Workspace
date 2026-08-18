import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../utils/response.js";
import { writeAudit } from "../../middleware/audit.js";
import { storage } from "../../services/storage.js";

const DESCRIPTION_MAX = 280;

const optionalText = (max, message) =>
  z
    .union([z.string().trim().max(max, message), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v ? v : null));

const customerFields = z.object({
  name: z.string().trim().min(2, "نام مشتری الزامی است").max(120),
  companyName: z.string().trim().min(2, "نام شرکت الزامی است").max(160),
  description: optionalText(
    DESCRIPTION_MAX,
    `توضیحات نباید بیشتر از ${DESCRIPTION_MAX} کاراکتر باشد`,
  ),
  imageKey: z.string().trim().min(1, "تصویر مشتری الزامی است").max(500),
  isPublished: z.boolean().optional().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().nullable(),
});

export const createCustomerSchema = customerFields;

export const updateCustomerSchema = customerFields
  .omit({ imageKey: true })
  .partial()
  .extend({
    imageKey: z
      .union([z.string().trim().max(500), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v ? v : undefined)),
  });

export const reorderCustomersSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

function imageUrlFor(key) {
  if (!key) return null;
  try {
    return storage.publicUrl(key);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[customers] imageUrl resolve failed:", key, err?.message || err);
    }
    return null;
  }
}

async function tryDeleteMedia(key) {
  if (!key) return;
  try {
    await storage.deleteObject(key);
  } catch (err) {
    console.warn("[customers] media cleanup failed:", key, err?.message || err);
  }
}

export function serializeCustomer(row, { publicView = false } = {}) {
  if (!row) return null;
  const payload = {
    id: row.id,
    name: row.name,
    companyName: row.companyName,
    description: row.description || null,
    imageUrl: imageUrlFor(row.imageKey),
    sortOrder: row.sortOrder ?? 0,
    isPublished: row.isPublished === true,
  };
  if (publicView) {
    return {
      id: payload.id,
      name: payload.name,
      companyName: payload.companyName,
      description: payload.description,
      imageUrl: payload.imageUrl,
      sortOrder: payload.sortOrder,
    };
  }
  return {
    ...payload,
    imageKey: row.imageKey || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const customersService = {
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
        { name: { contains: term, mode: "insensitive" } },
        { companyName: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
      ];
    }

    const take = Math.min(100, Math.max(1, Number(pageSize) || 100));
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;
    const baseWhere = { deletedAt: null };

    const [matched, allTotal, published, rows] = await Promise.all([
      prisma.showcaseCustomer.count({ where }),
      prisma.showcaseCustomer.count({ where: baseWhere }),
      prisma.showcaseCustomer.count({
        where: { ...baseWhere, isPublished: true },
      }),
      prisma.showcaseCustomer.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        skip,
        take,
      }),
    ]);

    return {
      items: rows.map((row) => serializeCustomer(row)),
      total: matched,
      published,
      unpublished: Math.max(0, allTotal - published),
      page: Math.max(1, Number(page) || 1),
      pageSize: take,
    };
  },

  async listPublic() {
    const rows = await prisma.showcaseCustomer.findMany({
      where: { isPublished: true, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return rows.map((row) => serializeCustomer(row, { publicView: true }));
  },

  async getById(id) {
    const row = await prisma.showcaseCustomer.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) throw new AppError("مشتری یافت نشد", 404, "NOT_FOUND");
    return serializeCustomer(row);
  },

  async create(body, auth, req) {
    const data = createCustomerSchema.parse(body);

    let sortOrder = data.sortOrder;
    if (sortOrder == null) {
      const latest = await prisma.showcaseCustomer.findFirst({
        where: { deletedAt: null },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      sortOrder = (latest?.sortOrder ?? 0) + 1;
    }

    const row = await prisma.showcaseCustomer.create({
      data: {
        name: data.name,
        companyName: data.companyName,
        description: data.description ?? null,
        imageKey: data.imageKey,
        isPublished: data.isPublished ?? true,
        sortOrder,
      },
    });

    await writeAudit({
      userId: auth?.userId,
      action: "SHOWCASE_CUSTOMER_CREATE",
      entityType: "ShowcaseCustomer",
      entityId: row.id,
      after: {
        name: row.name,
        companyName: row.companyName,
        isPublished: row.isPublished,
        sortOrder: row.sortOrder,
      },
      req,
    });

    return serializeCustomer(row);
  },

  async update(id, body, auth, req) {
    const existing = await prisma.showcaseCustomer.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new AppError("مشتری یافت نشد", 404, "NOT_FOUND");

    const data = updateCustomerSchema.parse(body);

    if (data.imageKey && data.imageKey !== existing.imageKey) {
      await tryDeleteMedia(existing.imageKey);
    }

    const row = await prisma.showcaseCustomer.update({
      where: { id },
      data: {
        ...(data.name != null ? { name: data.name } : {}),
        ...(data.companyName != null ? { companyName: data.companyName } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.imageKey ? { imageKey: data.imageKey } : {}),
        ...(data.isPublished != null ? { isPublished: data.isPublished } : {}),
        ...(data.sortOrder != null ? { sortOrder: data.sortOrder } : {}),
      },
    });

    await writeAudit({
      userId: auth?.userId,
      action: "SHOWCASE_CUSTOMER_UPDATE",
      entityType: "ShowcaseCustomer",
      entityId: row.id,
      before: {
        name: existing.name,
        companyName: existing.companyName,
        isPublished: existing.isPublished,
        sortOrder: existing.sortOrder,
        imageKey: existing.imageKey,
      },
      after: {
        name: row.name,
        companyName: row.companyName,
        isPublished: row.isPublished,
        sortOrder: row.sortOrder,
        imageKey: row.imageKey,
      },
      req,
    });

    return serializeCustomer(row);
  },

  async setPublished(id, isPublished, auth, req) {
    return this.update(id, { isPublished: Boolean(isPublished) }, auth, req);
  },

  async reorder(orderedIds, auth, req) {
    const ids = [...new Set(orderedIds.filter(Boolean))];
    const rows = await prisma.showcaseCustomer.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true },
    });
    if (rows.length !== ids.length) {
      throw new AppError("برخی مشتریان یافت نشدند", 404, "NOT_FOUND");
    }

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.showcaseCustomer.update({
          where: { id },
          data: { sortOrder: index + 1 },
        }),
      ),
    );

    await writeAudit({
      userId: auth?.userId,
      action: "SHOWCASE_CUSTOMER_REORDER",
      entityType: "ShowcaseCustomer",
      entityId: null,
      after: { orderedIds: ids },
      req,
    });

    return this.list({ pageSize: 100 });
  },

  async remove(id, auth, req) {
    const existing = await prisma.showcaseCustomer.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new AppError("مشتری یافت نشد", 404, "NOT_FOUND");

    await prisma.showcaseCustomer.update({
      where: { id },
      data: { deletedAt: new Date(), isPublished: false },
    });

    await tryDeleteMedia(existing.imageKey);

    await writeAudit({
      userId: auth?.userId,
      action: "SHOWCASE_CUSTOMER_DELETE",
      entityType: "ShowcaseCustomer",
      entityId: id,
      before: {
        name: existing.name,
        companyName: existing.companyName,
        imageKey: existing.imageKey,
      },
      req,
    });

    return { id, deleted: true };
  },
};
