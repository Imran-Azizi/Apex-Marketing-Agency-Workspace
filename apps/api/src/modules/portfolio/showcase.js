import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../utils/response.js";
import { writeAudit } from "../../middleware/audit.js";
import {
  itemInclude,
  serializeAdminItem,
  serializePublicItem,
  uniqueSlug,
} from "./service.js";

export const MIXED_SLUG = "mixed";
export const MIXED_LABEL = "کتگوری مختلط";

export const DEFAULT_PORTFOLIO_CATEGORIES = [
  {
    id: "pcat_beverages",
    name: "محصولات نوشیدنی",
    slug: "beverages",
    sortOrder: 1,
  },
  {
    id: "pcat_cosmetics",
    name: "محصولات آرایشی و بهداشتی",
    slug: "cosmetics",
    sortOrder: 2,
  },
  {
    id: "pcat_services",
    name: "شرکت های خدماتی",
    slug: "service-companies",
    sortOrder: 3,
  },
  {
    id: "pcat_transport",
    name: "شرکت های ترانسپورتی",
    slug: "transport",
    sortOrder: 4,
  },
  {
    id: "pcat_food",
    name: "محصولات خوراکی",
    slug: "food",
    sortOrder: 5,
  },
  {
    id: "pcat_agriculture",
    name: "محصولات زراعتی",
    slug: "agriculture",
    sortOrder: 6,
  },
];

const optionalText = (max) =>
  z
    .union([z.string().trim().max(max), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v ? v : null));

export const createPortfolioItemSchema = z.object({
  title: z.string().trim().min(3, "عنوان حداقل ۳ کاراکتر باشد").max(120),
  description: optionalText(2000),
  storageKey: z.string().trim().min(1, "ویدیوی نمونه‌کار الزامی است").max(500),
  thumbnailKey: optionalText(500),
  categoryIds: z.array(z.string().min(1)).optional().default([]),
  status: z.enum(["PUBLISHED", "UNPUBLISHED"]).optional().default("PUBLISHED"),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().nullable(),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(2, "نام کتگوری الزامی است").max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "اسلاگ فقط حروف انگلیسی، عدد و خط تیره باشد")
    .optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

export const mixedSelectionSchema = z.object({
  orderedIds: z.array(z.string().min(1)).max(500),
});

export const reorderPortfolioSchema = z.object({
  scope: z.enum(["mixed", "category", "items"]),
  categoryId: z.string().min(1).optional(),
  orderedIds: z.array(z.string().min(1)).min(1).max(500),
});

function slugifyCategory(input) {
  const base = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || `category-${Date.now().toString(36)}`;
}

async function uniqueCategorySlug(base, excludeId = null) {
  let candidate = slugifyCategory(base);
  let i = 0;
  while (true) {
    const existing = await prisma.portfolioCategory.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    i += 1;
    candidate = `${slugifyCategory(base)}-${i}`;
  }
}

export const playableVideoWhere = {
  OR: [
    { storageKey: { startsWith: "" } },
    { videoFile: { is: { deletedAt: null } } },
  ],
};

export const publicItemWhere = {
  deletedAt: null,
  status: "PUBLISHED",
  ...playableVideoWhere,
};

export const publicItemInclude = {
  project: {
    select: { service: { select: { name: true } } },
  },
  videoFile: {
    select: { id: true, mimeType: true, name: true, deletedAt: true },
  },
  categories: {
    where: { category: { deletedAt: null, isActive: true } },
    orderBy: { sortOrder: "asc" },
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  },
};

async function assertCategoryIds(categoryIds = []) {
  const unique = [...new Set((categoryIds || []).filter(Boolean))];
  if (!unique.length) return [];
  const rows = await prisma.portfolioCategory.findMany({
    where: { id: { in: unique }, deletedAt: null },
    select: { id: true },
  });
  if (rows.length !== unique.length) {
    throw new AppError("کتگوری انتخاب‌شده نامعتبر است", 400, "INVALID_CATEGORY");
  }
  return unique;
}

async function syncItemCategories(itemId, categoryIds) {
  const unique = await assertCategoryIds(categoryIds);
  const existing = await prisma.portfolioItemCategory.findMany({
    where: { itemId },
  });
  const existingMap = new Map(existing.map((row) => [row.categoryId, row.sortOrder]));

  await prisma.portfolioItemCategory.deleteMany({ where: { itemId } });

  for (const categoryId of unique) {
    let sortOrder = existingMap.get(categoryId);
    if (sortOrder == null) {
      const max = await prisma.portfolioItemCategory.aggregate({
        where: { categoryId },
        _max: { sortOrder: true },
      });
      sortOrder = (max._max.sortOrder ?? -1) + 1;
    }
    await prisma.portfolioItemCategory.create({
      data: { itemId, categoryId, sortOrder },
    });
  }
}

async function loadAdminItem(id) {
  const item = await prisma.portfolioItem.findFirst({
    where: { id, deletedAt: null },
    include: itemInclude,
  });
  if (!item) throw new AppError("نمونه‌کار یافت نشد", 404, "NOT_FOUND");
  return serializeAdminItem(item);
}

export async function listPublicShowcase(query = {}) {
  const category = String(query.category || MIXED_SLUG).trim() || MIXED_SLUG;

  if (category === MIXED_SLUG) {
    const rows = await prisma.mixedPortfolioItem.findMany({
      where: { item: publicItemWhere },
      orderBy: { sortOrder: "asc" },
      include: { item: { include: publicItemInclude } },
    });
    return {
      category: {
        slug: MIXED_SLUG,
        name: MIXED_LABEL,
        kind: "mixed",
      },
      items: rows.map((row) => serializePublicItem(row.item)),
      total: rows.length,
    };
  }

  const cat = await prisma.portfolioCategory.findFirst({
    where: { slug: category, deletedAt: null, isActive: true },
  });
  if (!cat) {
    return {
      category: { slug: category, name: category, kind: "category" },
      items: [],
      total: 0,
    };
  }

  const rows = await prisma.portfolioItemCategory.findMany({
    where: {
      categoryId: cat.id,
      item: publicItemWhere,
    },
    orderBy: { sortOrder: "asc" },
    include: { item: { include: publicItemInclude } },
  });

  return {
    category: {
      id: cat.id,
      slug: cat.slug,
      name: cat.name,
      kind: "category",
    },
    items: rows.map((row) => serializePublicItem(row.item)),
    total: rows.length,
  };
}

export async function getStats() {
  const [total, published, categories, mixed] = await Promise.all([
    prisma.portfolioItem.count({ where: { deletedAt: null } }),
    prisma.portfolioItem.count({
      where: { deletedAt: null, status: "PUBLISHED" },
    }),
    prisma.portfolioCategory.count({ where: { deletedAt: null, isActive: true } }),
    prisma.mixedPortfolioItem.count({
      where: { item: { deletedAt: null } },
    }),
  ]);
  return { total, published, categories, mixed };
}

export async function listCategoriesPublic() {
  const categories = await prisma.portfolioCategory.findMany({
    where: { deletedAt: null, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, slug: true, sortOrder: true },
  });

  const [mixedCount, counts] = await Promise.all([
    prisma.mixedPortfolioItem.count({
      where: { item: publicItemWhere },
    }),
    Promise.all(
      categories.map(async (category) => ({
        id: category.id,
        count: await prisma.portfolioItemCategory.count({
          where: {
            categoryId: category.id,
            item: publicItemWhere,
          },
        }),
      })),
    ),
  ]);

  const countMap = new Map(counts.map((row) => [row.id, row.count]));

  return {
    tabs: [
      {
        id: MIXED_SLUG,
        slug: MIXED_SLUG,
        name: MIXED_LABEL,
        kind: "mixed",
        videoCount: mixedCount,
      },
      ...categories.map((category) => ({
        id: category.id,
        slug: category.slug,
        name: category.name,
        kind: "category",
        sortOrder: category.sortOrder,
        videoCount: countMap.get(category.id) || 0,
      })),
    ],
  };
}

export async function listCategoriesAdmin() {
  const categories = await prisma.portfolioCategory.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      _count: {
        select: {
          items: { where: { item: { deletedAt: null } } },
        },
      },
    },
  });
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    isSystem: category.isSystem,
    itemCount: category._count.items,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  }));
}

export async function createCategory(body, actor, req) {
  const name = body.name.trim();
  const slug = await uniqueCategorySlug(body.slug || name);
  const max = await prisma.portfolioCategory.aggregate({
    where: { deletedAt: null },
    _max: { sortOrder: true },
  });
  const category = await prisma.portfolioCategory.create({
    data: {
      name,
      slug,
      sortOrder: body.sortOrder ?? (max._max.sortOrder ?? 0) + 1,
      isActive: body.isActive !== false,
      isSystem: false,
    },
  });
  await writeAudit({
    userId: actor.userId,
    action: "PORTFOLIO_CATEGORY_CREATE",
    entityType: "PortfolioCategory",
    entityId: category.id,
    after: { name, slug },
    req,
  });
  return category;
}

export async function updateCategory(id, body, actor, req) {
  const existing = await prisma.portfolioCategory.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw new AppError("کتگوری یافت نشد", 404, "NOT_FOUND");

  const category = await prisma.portfolioCategory.update({
    where: { id },
    data: {
      ...(body.name != null ? { name: body.name.trim() } : {}),
      ...(body.sortOrder != null ? { sortOrder: body.sortOrder } : {}),
      ...(body.isActive != null ? { isActive: body.isActive } : {}),
    },
  });

  await writeAudit({
    userId: actor.userId,
    action: "PORTFOLIO_CATEGORY_UPDATE",
    entityType: "PortfolioCategory",
    entityId: id,
    before: {
      name: existing.name,
      isActive: existing.isActive,
      sortOrder: existing.sortOrder,
    },
    after: {
      name: category.name,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
    },
    req,
  });
  return category;
}

export async function createItem(body, actor, req) {
  const title = body.title.trim();
  const now = new Date();
  const status = body.status || "PUBLISHED";
  const item = await prisma.portfolioItem.create({
    data: {
      title,
      description: body.description || null,
      slug: await uniqueSlug(title),
      storageKey: body.storageKey,
      thumbnailKey: body.thumbnailKey || null,
      status,
      sortOrder: body.sortOrder ?? 0,
      publishedAt: status === "PUBLISHED" ? now : null,
      publishedById: status === "PUBLISHED" ? actor.userId : null,
    },
  });
  await syncItemCategories(item.id, body.categoryIds || []);
  const created = await loadAdminItem(item.id);
  await writeAudit({
    userId: actor.userId,
    action: "PORTFOLIO_CREATE",
    entityType: "PortfolioItem",
    entityId: item.id,
    after: {
      title: created.title,
      status: created.status,
      storageKey: body.storageKey,
      categoryIds: body.categoryIds || [],
    },
    req,
  });
  return created;
}

export async function syncCategoriesForItem(itemId, categoryIds) {
  await syncItemCategories(itemId, categoryIds);
}

export async function listMixedAdmin() {
  const rows = await prisma.mixedPortfolioItem.findMany({
    where: { item: { deletedAt: null } },
    orderBy: { sortOrder: "asc" },
    include: { item: { include: itemInclude } },
  });
  return {
    items: rows.map((row) => ({
      ...serializeAdminItem(row.item),
      mixedSortOrder: row.sortOrder,
    })),
  };
}

export async function setMixed(orderedIds, actor, req) {
  const unique = [...new Set(orderedIds.filter(Boolean))];
  if (unique.length) {
    const found = await prisma.portfolioItem.findMany({
      where: { id: { in: unique }, deletedAt: null },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      throw new AppError("برخی نمونه‌کارهای انتخاب‌شده یافت نشد", 400, "INVALID_ITEM");
    }
  }

  await prisma.$transaction([
    prisma.mixedPortfolioItem.deleteMany({}),
    ...unique.map((itemId, index) =>
      prisma.mixedPortfolioItem.create({
        data: { itemId, sortOrder: index },
      }),
    ),
  ]);

  await writeAudit({
    userId: actor.userId,
    action: "PORTFOLIO_MIXED_UPDATE",
    entityType: "MixedPortfolioItem",
    entityId: "mixed",
    after: { orderedIds: unique },
    req,
  });

  return listMixedAdmin();
}

export async function reorderPortfolio(body, actor, req) {
  const orderedIds = [...new Set(body.orderedIds.filter(Boolean))];
  if (body.scope === "mixed") {
    return setMixed(orderedIds, actor, req);
  }

  if (body.scope === "category") {
    if (!body.categoryId) {
      throw new AppError("کتگوری برای مرتب‌سازی الزامی است", 400, "CATEGORY_REQUIRED");
    }
    const category = await prisma.portfolioCategory.findFirst({
      where: { id: body.categoryId, deletedAt: null },
    });
    if (!category) throw new AppError("کتگوری یافت نشد", 404, "NOT_FOUND");

    const existing = await prisma.portfolioItemCategory.findMany({
      where: {
        categoryId: body.categoryId,
        itemId: { in: orderedIds },
      },
    });
    if (existing.length !== orderedIds.length) {
      throw new AppError("ترتیب کتگوری نامعتبر است", 400, "INVALID_ORDER");
    }

    await prisma.$transaction(
      orderedIds.map((itemId, index) =>
        prisma.portfolioItemCategory.update({
          where: { itemId_categoryId: { itemId, categoryId: body.categoryId } },
          data: { sortOrder: index },
        }),
      ),
    );

    await writeAudit({
      userId: actor.userId,
      action: "PORTFOLIO_CATEGORY_REORDER",
      entityType: "PortfolioCategory",
      entityId: body.categoryId,
      after: { orderedIds },
      req,
    });
    return { ok: true, orderedIds };
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.portfolioItem.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );
  await writeAudit({
    userId: actor.userId,
    action: "PORTFOLIO_REORDER",
    entityType: "PortfolioItem",
    entityId: "items",
    after: { orderedIds },
    req,
  });
  return { ok: true, orderedIds };
}

export const showcaseMethods = {
  listPublicShowcase,
  getStats,
  listCategoriesPublic,
  listCategoriesAdmin,
  createCategory,
  updateCategory,
  createItem,
  syncCategoriesForItem,
  listMixedAdmin,
  setMixed,
  reorderPortfolio,
};
