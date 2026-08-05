-- Payment manager-approval workflow:
-- Add rejection audit fields. Existing PENDING payments were already counted in
-- finances under the old rules — promote them to VERIFIED so balances stay stable.
-- New payments default to PENDING and require manager approval before affecting totals.

ALTER TABLE "public"."payments"
  ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectedById" TEXT,
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_rejectedById_fkey'
  ) THEN
    ALTER TABLE "public"."payments"
      ADD CONSTRAINT "payments_rejectedById_fkey"
      FOREIGN KEY ("rejectedById") REFERENCES "public"."users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "payments_createdAt_idx" ON "public"."payments"("createdAt");

-- Preserve historical financial totals: prior PENDING rows already affected caches.
UPDATE "public"."payments"
SET
  "verification" = 'VERIFIED',
  "verifiedAt" = COALESCE("verifiedAt", "paidAt", "createdAt", NOW())
WHERE "verification" = 'PENDING';
