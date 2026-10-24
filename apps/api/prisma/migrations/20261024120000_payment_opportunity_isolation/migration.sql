-- Isolate payments per opportunity/project cycle.
-- Direct payments (no invoice) must not be counted on every opportunity of the customer.

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "opportunityId" TEXT;

CREATE INDEX IF NOT EXISTS "payments_opportunityId_idx" ON "payments"("opportunityId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_opportunityId_fkey'
  ) THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_opportunityId_fkey"
      FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill from linked invoices
UPDATE "payments" AS p
SET "opportunityId" = i."opportunityId"
FROM "invoices" AS i
WHERE p."invoiceId" = i."id"
  AND p."opportunityId" IS NULL
  AND i."opportunityId" IS NOT NULL;

-- Backfill orphan direct payments only when the customer has exactly one live opportunity
UPDATE "payments" AS p
SET "opportunityId" = solo."id"
FROM (
  SELECT "crmCustomerId", MIN(id) AS id
  FROM "opportunities"
  WHERE "deletedAt" IS NULL
  GROUP BY "crmCustomerId"
  HAVING COUNT(*) = 1
) AS solo
WHERE p."crmCustomerId" = solo."crmCustomerId"
  AND p."invoiceId" IS NULL
  AND p."opportunityId" IS NULL;
