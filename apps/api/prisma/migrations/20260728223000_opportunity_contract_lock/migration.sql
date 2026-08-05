-- Lock contract price + terms after first professional save.
ALTER TABLE "opportunities"
  ADD COLUMN IF NOT EXISTS "contractLocked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "contractLockedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "contractLockedById" TEXT;

-- Backfill: existing contracts with price + terms are already finalized.
UPDATE "opportunities"
SET
  "contractLocked" = true,
  "contractLockedAt" = COALESCE("contractLockedAt", NOW())
WHERE "deletedAt" IS NULL
  AND "contractLocked" = false
  AND "agreedPrice" IS NOT NULL
  AND "agreedPrice" > 0
  AND "agreedTerms" IS NOT NULL
  AND TRIM("agreedTerms") <> '';
