-- AlterTable
ALTER TABLE "users" ADD COLUMN "cvStorageKey" TEXT;
ALTER TABLE "users" ADD COLUMN "cvFileName" TEXT;
ALTER TABLE "users" ADD COLUMN "cvMimeType" TEXT;
ALTER TABLE "users" ADD COLUMN "cvSizeBytes" INTEGER;
ALTER TABLE "users" ADD COLUMN "cvUploadedAt" TIMESTAMP(3);
