-- CRM sales pipeline: expanded stages, customer codes, activity timeline, invoice extras.

-- 1) Recreate pipeline enum with the production lifecycle values.
CREATE TYPE "CrmPipelineStage_new" AS ENUM (
  'NEW_LEAD',
  'CONTACTED',
  'INFORMATION_SENT',
  'PROPOSAL_PRICE_SENT',
  'WAITING_DECISION',
  'ORDER_CONFIRMED',
  'DEPOSIT_PENDING',
  'DEPOSIT_CONFIRMED',
  'PORTAL_INVITED',
  'PROJECT_CREATED',
  'DELIVERED',
  'REPEAT_CUSTOMER',
  'LOST_CANCELED'
);

ALTER TABLE "crm_customers" ALTER COLUMN "pipelineStage" DROP DEFAULT;
ALTER TABLE "opportunities" ALTER COLUMN "pipelineStage" DROP DEFAULT;

ALTER TABLE "crm_customers"
  ALTER COLUMN "pipelineStage" TYPE "CrmPipelineStage_new"
  USING (
    CASE "pipelineStage"::text
      WHEN 'INTERESTED' THEN 'INFORMATION_SENT'
      WHEN 'PRICE_SENT' THEN 'PROPOSAL_PRICE_SENT'
      WHEN 'COMPLETED' THEN 'DELIVERED'
      WHEN 'CANCELED' THEN 'LOST_CANCELED'
      ELSE "pipelineStage"::text
    END
  )::"CrmPipelineStage_new";

ALTER TABLE "opportunities"
  ALTER COLUMN "pipelineStage" TYPE "CrmPipelineStage_new"
  USING (
    CASE "pipelineStage"::text
      WHEN 'INTERESTED' THEN 'INFORMATION_SENT'
      WHEN 'PRICE_SENT' THEN 'PROPOSAL_PRICE_SENT'
      WHEN 'COMPLETED' THEN 'DELIVERED'
      WHEN 'CANCELED' THEN 'LOST_CANCELED'
      ELSE "pipelineStage"::text
    END
  )::"CrmPipelineStage_new";

DROP TYPE "CrmPipelineStage";
ALTER TYPE "CrmPipelineStage_new" RENAME TO "CrmPipelineStage";

ALTER TABLE "crm_customers" ALTER COLUMN "pipelineStage" SET DEFAULT 'NEW_LEAD';
ALTER TABLE "opportunities" ALTER COLUMN "pipelineStage" SET DEFAULT 'NEW_LEAD';

-- 2) Customer public ID
CREATE SEQUENCE IF NOT EXISTS crm_customer_code_seq START WITH 1 INCREMENT BY 1;

ALTER TABLE "crm_customers" ADD COLUMN IF NOT EXISTS "customerCode" TEXT;
ALTER TABLE "crm_customers" ADD COLUMN IF NOT EXISTS "phoneCountryIso" TEXT;
ALTER TABLE "crm_customers" ADD COLUMN IF NOT EXISTS "previousWhatsapp" JSONB;
ALTER TABLE "crm_customers" ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP(3);
ALTER TABLE "crm_customers" ADD COLUMN IF NOT EXISTS "customerInfoSavedAt" TIMESTAMP(3);

UPDATE "crm_customers"
SET "customerCode" = 'APEX-' || LPAD(nextval('crm_customer_code_seq')::text, 5, '0')
WHERE "customerCode" IS NULL;

ALTER TABLE "crm_customers" ALTER COLUMN "customerCode" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "crm_customers_customerCode_key" ON "crm_customers"("customerCode");
CREATE INDEX IF NOT EXISTS "crm_customers_customerCode_idx" ON "crm_customers"("customerCode");
CREATE INDEX IF NOT EXISTS "crm_customers_convertedAt_idx" ON "crm_customers"("convertedAt");
CREATE INDEX IF NOT EXISTS "crm_customers_lastContactAt_idx" ON "crm_customers"("lastContactAt");

-- Existing customers with verified payment / portal / project are already converted.
UPDATE "crm_customers" c
SET "convertedAt" = COALESCE(c."convertedAt", c."createdAt")
WHERE c."deletedAt" IS NULL
  AND c."convertedAt" IS NULL
  AND (
    EXISTS (
      SELECT 1 FROM "payments" p
      WHERE p."crmCustomerId" = c."id" AND p."verification" = 'VERIFIED'
    )
    OR EXISTS (
      SELECT 1 FROM "portal_accounts" pa
      WHERE pa."crmCustomerId" = c."id" AND pa."deletedAt" IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM "projects" pr
      WHERE pr."crmCustomerId" = c."id" AND pr."deletedAt" IS NULL
    )
  );

-- Refine live pipeline from actual business events (does not override lost leads).
UPDATE "crm_customers" c
SET "pipelineStage" = 'DELIVERED'
WHERE c."deletedAt" IS NULL
  AND c."pipelineStage" NOT IN ('LOST_CANCELED')
  AND EXISTS (
    SELECT 1 FROM "projects" pr
    WHERE pr."crmCustomerId" = c."id"
      AND pr."deletedAt" IS NULL
      AND pr."status" = 'COMPLETED'
  );

UPDATE "crm_customers" c
SET "pipelineStage" = 'PROJECT_CREATED'
WHERE c."deletedAt" IS NULL
  AND c."pipelineStage" NOT IN ('LOST_CANCELED', 'DELIVERED', 'REPEAT_CUSTOMER')
  AND EXISTS (
    SELECT 1 FROM "projects" pr
    WHERE pr."crmCustomerId" = c."id" AND pr."deletedAt" IS NULL
  );

UPDATE "crm_customers" c
SET "pipelineStage" = 'PORTAL_INVITED'
WHERE c."deletedAt" IS NULL
  AND c."pipelineStage" NOT IN ('LOST_CANCELED', 'DELIVERED', 'REPEAT_CUSTOMER', 'PROJECT_CREATED')
  AND (
    c."portalStatus" IN ('INVITED', 'REGISTERED')
    OR EXISTS (
      SELECT 1 FROM "portal_invites" i WHERE i."crmCustomerId" = c."id"
    )
  );

UPDATE "crm_customers" c
SET "pipelineStage" = 'DEPOSIT_CONFIRMED'
WHERE c."deletedAt" IS NULL
  AND c."pipelineStage" NOT IN (
    'LOST_CANCELED', 'DELIVERED', 'REPEAT_CUSTOMER', 'PROJECT_CREATED', 'PORTAL_INVITED'
  )
  AND EXISTS (
    SELECT 1 FROM "payments" p
    WHERE p."crmCustomerId" = c."id" AND p."verification" = 'VERIFIED'
  );

UPDATE "crm_customers" c
SET "pipelineStage" = 'DEPOSIT_PENDING'
WHERE c."deletedAt" IS NULL
  AND c."pipelineStage" = 'ORDER_CONFIRMED'
  AND EXISTS (
    SELECT 1 FROM "invoices" inv
    WHERE inv."crmCustomerId" = c."id" AND inv."status" <> 'CANCELED'
  )
  AND NOT EXISTS (
    SELECT 1 FROM "payments" p
    WHERE p."crmCustomerId" = c."id" AND p."verification" = 'VERIFIED'
  );

UPDATE "opportunities" o
SET "pipelineStage" = c."pipelineStage"
FROM "crm_customers" c
WHERE o."crmCustomerId" = c."id"
  AND o."deletedAt" IS NULL
  AND c."deletedAt" IS NULL;

-- 3) Activity timeline
CREATE TABLE IF NOT EXISTS "crm_activities" (
  "id" TEXT NOT NULL,
  "crmCustomerId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "previousStatus" TEXT,
  "newStatus" TEXT,
  "actorId" TEXT,
  "actorType" TEXT NOT NULL DEFAULT 'SYSTEM',
  "source" TEXT,
  "relatedType" TEXT,
  "relatedId" TEXT,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "crm_activities_crmCustomerId_createdAt_idx" ON "crm_activities"("crmCustomerId", "createdAt");
CREATE INDEX IF NOT EXISTS "crm_activities_type_idx" ON "crm_activities"("type");
CREATE INDEX IF NOT EXISTS "crm_activities_relatedType_relatedId_idx" ON "crm_activities"("relatedType", "relatedId");

ALTER TABLE "crm_activities"
  ADD CONSTRAINT "crm_activities_crmCustomerId_fkey"
  FOREIGN KEY ("crmCustomerId") REFERENCES "crm_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crm_activities"
  ADD CONSTRAINT "crm_activities_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4) Invoice extras
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "videoCount" INTEGER;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "paymentMethod" "PaymentMethod";
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "paymentMethodMeta" JSONB;

-- 5) Link public contact messages to CRM leads
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "crmCustomerId" TEXT;
CREATE INDEX IF NOT EXISTS "contact_messages_crmCustomerId_idx" ON "contact_messages"("crmCustomerId");
ALTER TABLE "contact_messages"
  ADD CONSTRAINT "contact_messages_crmCustomerId_fkey"
  FOREIGN KEY ("crmCustomerId") REFERENCES "crm_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
