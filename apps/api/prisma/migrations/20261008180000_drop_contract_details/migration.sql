ALTER TABLE "projects"
  DROP COLUMN IF EXISTS "contractPeriod",
  DROP COLUMN IF EXISTS "contractNotes",
  DROP COLUMN IF EXISTS "plannedVideoCount",
  DROP COLUMN IF EXISTS "contractAmount";
