-- CreateEnum
CREATE TYPE "EditingTaskStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'REVIEW_REQUIRED', 'REVISION_REQUESTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EditingAssetType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'EXTERNAL', 'AI_GENERATED', 'OTHER');

-- AlterTable
ALTER TABLE "project_assignments" ADD COLUMN     "assignedById" TEXT;

-- CreateTable
CREATE TABLE "editing_tasks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "editorUserId" TEXT,
    "editorTeamProfileId" TEXT,
    "assignedById" TEXT,
    "status" "EditingTaskStatus" NOT NULL DEFAULT 'ASSIGNED',
    "deadline" TIMESTAMP(3),
    "instructions" TEXT,
    "revisionNotes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "watermarkedFileId" TEXT,
    "cleanFileId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editing_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editing_resources" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "editingTaskId" TEXT NOT NULL,
    "editorId" TEXT,
    "assetType" "EditingAssetType" NOT NULL DEFAULT 'OTHER',
    "assetName" TEXT NOT NULL,
    "assetUrl" TEXT,
    "aiTool" TEXT,
    "promptUsed" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editing_resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "editing_tasks_projectId_status_idx" ON "editing_tasks"("projectId", "status");

-- CreateIndex
CREATE INDEX "editing_tasks_editorUserId_status_idx" ON "editing_tasks"("editorUserId", "status");

-- CreateIndex
CREATE INDEX "editing_tasks_deadline_idx" ON "editing_tasks"("deadline");

-- CreateIndex
CREATE INDEX "editing_resources_projectId_idx" ON "editing_resources"("projectId");

-- CreateIndex
CREATE INDEX "editing_resources_editingTaskId_idx" ON "editing_resources"("editingTaskId");

-- CreateIndex
CREATE INDEX "project_assignments_userId_idx" ON "project_assignments"("userId");

-- AddForeignKey
ALTER TABLE "editing_tasks" ADD CONSTRAINT "editing_tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editing_tasks" ADD CONSTRAINT "editing_tasks_editorUserId_fkey" FOREIGN KEY ("editorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editing_tasks" ADD CONSTRAINT "editing_tasks_editorTeamProfileId_fkey" FOREIGN KEY ("editorTeamProfileId") REFERENCES "team_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editing_tasks" ADD CONSTRAINT "editing_tasks_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editing_tasks" ADD CONSTRAINT "editing_tasks_watermarkedFileId_fkey" FOREIGN KEY ("watermarkedFileId") REFERENCES "project_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editing_tasks" ADD CONSTRAINT "editing_tasks_cleanFileId_fkey" FOREIGN KEY ("cleanFileId") REFERENCES "project_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editing_resources" ADD CONSTRAINT "editing_resources_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editing_resources" ADD CONSTRAINT "editing_resources_editingTaskId_fkey" FOREIGN KEY ("editingTaskId") REFERENCES "editing_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editing_resources" ADD CONSTRAINT "editing_resources_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
