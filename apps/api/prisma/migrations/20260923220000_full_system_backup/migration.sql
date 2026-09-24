-- Full-system backup metadata: large archives + progress tracking
ALTER TABLE "system_backups" ALTER COLUMN "sizeBytes" SET DATA TYPE BIGINT;
ALTER TABLE "system_backups" ADD COLUMN "mediaFileCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "system_backups" ADD COLUMN "mediaBytes" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "system_backups" ADD COLUMN "progressPercent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "system_backups" ADD COLUMN "progressPhase" TEXT;
ALTER TABLE "system_backups" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'FULL_SYSTEM';
