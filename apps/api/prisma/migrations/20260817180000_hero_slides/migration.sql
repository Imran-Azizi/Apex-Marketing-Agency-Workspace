-- CreateTable
CREATE TABLE "hero_slides" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageKey" TEXT NOT NULL,
    "altText" TEXT,
    "primaryButtonText" TEXT,
    "primaryButtonUrl" TEXT,
    "secondaryButtonText" TEXT,
    "secondaryButtonUrl" TEXT,
    "overlayOpacity" INTEGER NOT NULL DEFAULT 45,
    "imagePosition" TEXT NOT NULL DEFAULT 'center',
    "durationMs" INTEGER NOT NULL DEFAULT 6000,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "hero_slides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hero_slides_isPublished_sortOrder_idx" ON "hero_slides"("isPublished", "sortOrder");

-- CreateIndex
CREATE INDEX "hero_slides_deletedAt_idx" ON "hero_slides"("deletedAt");

-- CreateIndex
CREATE INDEX "hero_slides_sortOrder_idx" ON "hero_slides"("sortOrder");

-- Hero slide permissions
INSERT INTO "permissions" ("id", "code", "description", "createdAt")
VALUES
  ('rbac_hero_view', 'hero.view', 'مشاهده اسلایدهای Hero در پنل', CURRENT_TIMESTAMP),
  ('rbac_hero_create', 'hero.create', 'ایجاد اسلاید Hero', CURRENT_TIMESTAMP),
  ('rbac_hero_edit', 'hero.edit', 'ویرایش، ترتیب و انتشار اسلایدهای Hero', CURRENT_TIMESTAMP),
  ('rbac_hero_delete', 'hero.delete', 'حذف اسلاید Hero', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" IN ('MANAGER', 'ADMIN')
  AND p."code" IN ('hero.view', 'hero.create', 'hero.edit', 'hero.delete')
ON CONFLICT DO NOTHING;
