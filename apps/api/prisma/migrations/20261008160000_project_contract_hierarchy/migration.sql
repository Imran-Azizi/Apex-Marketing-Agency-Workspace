-- Monthly / multi-video contracts.
-- Existing projects stay SINGLE with no parent, so the current workflow is unchanged.

CREATE TYPE "ProjectKind" AS ENUM ('SINGLE', 'CONTRACT', 'CHILD');

ALTER TABLE "projects"
  ADD COLUMN "kind" "ProjectKind" NOT NULL DEFAULT 'SINGLE',
  ADD COLUMN "parentProjectId" TEXT,
  ADD COLUMN "contractPeriod" TEXT,
  ADD COLUMN "contractNotes" TEXT,
  ADD COLUMN "plannedVideoCount" INTEGER,
  ADD COLUMN "contractAmount" DECIMAL(14,2);

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_parentProjectId_fkey"
  FOREIGN KEY ("parentProjectId") REFERENCES "projects"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_kind_parent_ck"
  CHECK (
    ("kind" = 'CHILD' AND "parentProjectId" IS NOT NULL)
    OR ("kind" IN ('SINGLE', 'CONTRACT') AND "parentProjectId" IS NULL)
  );

CREATE INDEX "projects_parentProjectId_idx" ON "projects"("parentProjectId");
CREATE INDEX "projects_kind_idx" ON "projects"("kind");
CREATE INDEX "projects_deletedAt_kind_idx" ON "projects"("deletedAt", "kind");
