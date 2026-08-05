-- Prisma migrates in a transaction; enum ADD VALUE must be committed
-- before the new labels can be used in UPDATEs (PostgreSQL).
ALTER TYPE "ContentVersionStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "ContentVersionStatus" ADD VALUE 'PENDING_CUSTOMER_APPROVAL';
ALTER TYPE "ContentVersionStatus" ADD VALUE 'REVISION_REQUESTED';
