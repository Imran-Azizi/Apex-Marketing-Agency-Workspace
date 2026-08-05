-- Payment / delivery / portfolio workflow fields

DO $$ BEGIN
  CREATE TYPE "PaymentSettlementStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'OVERRIDE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DeliveryWorkflowStatus" AS ENUM ('NOT_READY', 'AWAITING_PAYMENT', 'AWAITING_MANAGER_APPROVAL', 'READY_FOR_DOWNLOAD', 'DELIVERED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CleanFileAccessStatus" AS ENUM ('HIDDEN', 'LOCKED_PAYMENT', 'LOCKED_APPROVAL', 'AVAILABLE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "PortfolioStatus" ADD VALUE 'REVIEW';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "paymentStatus" "PaymentSettlementStatus" NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN IF NOT EXISTS "deliveryStatus" "DeliveryWorkflowStatus" NOT NULL DEFAULT 'NOT_READY',
  ADD COLUMN IF NOT EXISTS "cleanFileAccess" "CleanFileAccessStatus" NOT NULL DEFAULT 'HIDDEN';

CREATE INDEX IF NOT EXISTS "projects_deliveryStatus_idx" ON "projects"("deliveryStatus");
CREATE INDEX IF NOT EXISTS "projects_paymentStatus_idx" ON "projects"("paymentStatus");

ALTER TABLE "download_history"
  ADD COLUMN IF NOT EXISTS "projectId" TEXT,
  ADD COLUMN IF NOT EXISTS "crmCustomerId" TEXT,
  ADD COLUMN IF NOT EXISTS "fileId" TEXT,
  ADD COLUMN IF NOT EXISTS "fileType" TEXT,
  ADD COLUMN IF NOT EXISTS "userAgent" TEXT,
  ADD COLUMN IF NOT EXISTS "meta" JSONB;

DO $$ BEGIN
  ALTER TABLE "download_history"
    ADD CONSTRAINT "download_history_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "download_history_projectId_createdAt_idx" ON "download_history"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "download_history_portalAccountId_idx" ON "download_history"("portalAccountId");

ALTER TABLE "portfolio_items"
  ADD COLUMN IF NOT EXISTS "description" TEXT;
