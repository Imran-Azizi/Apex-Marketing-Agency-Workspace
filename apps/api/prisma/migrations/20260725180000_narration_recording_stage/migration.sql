-- CreateEnum
CREATE TYPE "NarrationTaskStatus" AS ENUM (
  'PENDING_NARRATION',
  'RECORDING_IN_PROGRESS',
  'NARRATION_SUBMITTED',
  'APPROVED',
  'REVISION_REQUESTED'
);

-- CreateTable
CREATE TABLE "narration_tasks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contentVersionId" TEXT,
    "narratorUserId" TEXT,
    "narratorTeamProfileId" TEXT,
    "assignedById" TEXT,
    "status" "NarrationTaskStatus" NOT NULL DEFAULT 'PENDING_NARRATION',
    "deadline" TIMESTAMP(3),
    "narrationScriptSnapshot" JSONB,
    "audioFileId" TEXT,
    "revisionNotes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "narration_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "narration_takes" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "projectFileId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "notes" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "narration_takes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "narration_tasks_projectId_status_idx" ON "narration_tasks"("projectId", "status");
CREATE INDEX "narration_tasks_narratorUserId_status_idx" ON "narration_tasks"("narratorUserId", "status");
CREATE INDEX "narration_tasks_deadline_idx" ON "narration_tasks"("deadline");
CREATE INDEX "narration_takes_taskId_version_idx" ON "narration_takes"("taskId", "version");

ALTER TABLE "narration_tasks"
  ADD CONSTRAINT "narration_tasks_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "narration_tasks"
  ADD CONSTRAINT "narration_tasks_contentVersionId_fkey"
  FOREIGN KEY ("contentVersionId") REFERENCES "content_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "narration_tasks"
  ADD CONSTRAINT "narration_tasks_narratorUserId_fkey"
  FOREIGN KEY ("narratorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "narration_tasks"
  ADD CONSTRAINT "narration_tasks_narratorTeamProfileId_fkey"
  FOREIGN KEY ("narratorTeamProfileId") REFERENCES "team_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "narration_tasks"
  ADD CONSTRAINT "narration_tasks_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "narration_tasks"
  ADD CONSTRAINT "narration_tasks_audioFileId_fkey"
  FOREIGN KEY ("audioFileId") REFERENCES "project_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "narration_takes"
  ADD CONSTRAINT "narration_takes_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "narration_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "narration_takes"
  ADD CONSTRAINT "narration_takes_projectFileId_fkey"
  FOREIGN KEY ("projectFileId") REFERENCES "project_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "narration_takes"
  ADD CONSTRAINT "narration_takes_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
