-- CreateEnum
CREATE TYPE "LandingPageStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "landing_pages" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "draftContent" JSONB NOT NULL,
    "publishedContent" JSONB,
    "status" "LandingPageStatus" NOT NULL DEFAULT 'DRAFT',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "seoKeywords" TEXT,
    "ogTitle" TEXT,
    "ogDescription" TEXT,
    "ogImageKey" TEXT,
    "canonicalUrl" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "landing_pages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "landing_pages_slug_key" ON "landing_pages"("slug");
CREATE INDEX "landing_pages_isPublished_deletedAt_idx" ON "landing_pages"("isPublished", "deletedAt");
CREATE INDEX "landing_pages_status_deletedAt_idx" ON "landing_pages"("status", "deletedAt");
CREATE INDEX "landing_pages_deletedAt_idx" ON "landing_pages"("deletedAt");
CREATE INDEX "landing_pages_createdAt_idx" ON "landing_pages"("createdAt");
CREATE INDEX "landing_pages_slug_deletedAt_idx" ON "landing_pages"("slug", "deletedAt");

ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "description", "createdAt")
VALUES
  ('rbac_landing_pages_view', 'landing_pages.view', 'مشاهده فهرست صفحات لندنگ در پنل', CURRENT_TIMESTAMP),
  ('rbac_landing_pages_create', 'landing_pages.create', 'ایجاد صفحه لندنگ جدید', CURRENT_TIMESTAMP),
  ('rbac_landing_pages_edit', 'landing_pages.edit', 'ویرایش محتوا، تنظیمات و پیش‌نویس صفحه لندنگ', CURRENT_TIMESTAMP),
  ('rbac_landing_pages_publish', 'landing_pages.publish', 'انتشار یا لغو انتشار صفحه لندنگ', CURRENT_TIMESTAMP),
  ('rbac_landing_pages_delete', 'landing_pages.delete', 'حذف صفحه لندنگ', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
