-- CreateEnum
CREATE TYPE "VideoStorageStatus" AS ENUM ('UPLOADED', 'UNDER_REVIEW', 'IN_PORTFOLIO', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "VideoProcessingStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "company_videos" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "originalFilename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "thumbnailKey" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "durationSeconds" DOUBLE PRECISION,
    "status" "VideoStorageStatus" NOT NULL DEFAULT 'UPLOADED',
    "processingStatus" "VideoProcessingStatus" NOT NULL DEFAULT 'READY',
    "uploadedByUserId" TEXT NOT NULL,
    "portfolioItemId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "company_videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_videos_portfolioItemId_key" ON "company_videos"("portfolioItemId");

-- CreateIndex
CREATE INDEX "company_videos_uploadedByUserId_createdAt_idx" ON "company_videos"("uploadedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "company_videos_status_createdAt_idx" ON "company_videos"("status", "createdAt");

-- CreateIndex
CREATE INDEX "company_videos_createdAt_idx" ON "company_videos"("createdAt");

-- CreateIndex
CREATE INDEX "company_videos_deletedAt_idx" ON "company_videos"("deletedAt");

-- CreateIndex
CREATE INDEX "company_videos_processingStatus_idx" ON "company_videos"("processingStatus");

-- AddForeignKey
ALTER TABLE "company_videos" ADD CONSTRAINT "company_videos_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_videos" ADD CONSTRAINT "company_videos_portfolioItemId_fkey" FOREIGN KEY ("portfolioItemId") REFERENCES "portfolio_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed Video Storage permissions
INSERT INTO "permissions" ("id", "code", "description", "createdAt")
VALUES
  ('rbac_video_storage_view', 'video_storage.view', 'دسترسی به مدیریت ویدیوها', CURRENT_TIMESTAMP),
  ('rbac_video_storage_upload', 'video_storage.upload', 'بارگذاری ویدیو در فضای ذخیره‌سازی شرکت', CURRENT_TIMESTAMP),
  ('rbac_video_storage_edit', 'video_storage.edit', 'ویرایش ویدیوهای مجاز', CURRENT_TIMESTAMP),
  ('rbac_video_storage_delete', 'video_storage.delete', 'حذف ویدیوهای مجاز', CURRENT_TIMESTAMP),
  ('rbac_video_storage_send_portfolio', 'video_storage.send_portfolio', 'ارسال ویدیو به نمونه‌کارها', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
