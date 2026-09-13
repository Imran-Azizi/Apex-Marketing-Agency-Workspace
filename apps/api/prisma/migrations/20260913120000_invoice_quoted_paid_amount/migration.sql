-- Sample CRM invoices store a display-only payable. Not a financial Payment.
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "quotedPaidAmount" DECIMAL(14, 2) NOT NULL DEFAULT 0;

-- Backfill from any payments that were incorrectly posted against sample invoices.
UPDATE "invoices" AS i
SET "quotedPaidAmount" = COALESCE((
  SELECT SUM(p."amount")
  FROM "payments" AS p
  WHERE p."invoiceId" = i."id"
    AND p."verification" = 'VERIFIED'
), 0)
WHERE i."opportunityId" IS NULL
  AND i."projectId" IS NULL
  AND COALESCE(i."quotedPaidAmount", 0) = 0;
