-- CreateEnum
CREATE TYPE "AiAgentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ContentVersionStatus" AS ENUM ('DRAFT', 'EDITED', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "AiWorkflowStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL');

-- AlterTable content_versions
ALTER TABLE "content_versions" ADD COLUMN IF NOT EXISTS "extras" JSONB;
ALTER TABLE "content_versions" ADD COLUMN IF NOT EXISTS "status" "ContentVersionStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "content_versions" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "content_versions" ADD COLUMN IF NOT EXISTS "rejectedById" TEXT;
ALTER TABLE "content_versions" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "content_versions" ADD COLUMN IF NOT EXISTS "changeNotes" TEXT;
ALTER TABLE "content_versions" ADD COLUMN IF NOT EXISTS "workflowId" TEXT;

CREATE INDEX IF NOT EXISTS "content_versions_projectId_status_idx" ON "content_versions"("projectId", "status");

-- CreateTable ai_agents
CREATE TABLE IF NOT EXISTS "ai_agents" (
    "id" TEXT NOT NULL,
    "code" "AiAgentType" NOT NULL,
    "name" TEXT NOT NULL,
    "nameFa" TEXT,
    "description" TEXT,
    "descriptionFa" TEXT,
    "status" "AiAgentStatus" NOT NULL DEFAULT 'ACTIVE',
    "promptTemplate" TEXT,
    "promptVersion" TEXT NOT NULL DEFAULT 'v1',
    "n8nWebhookPath" TEXT,
    "config" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_agents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_agents_code_key" ON "ai_agents"("code");

-- CreateTable ai_workflow_executions
CREATE TABLE IF NOT EXISTS "ai_workflow_executions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "AiWorkflowStatus" NOT NULL DEFAULT 'PENDING',
    "steps" JSONB NOT NULL,
    "contentVersionId" TEXT,
    "n8nExecutionId" TEXT,
    "error" TEXT,
    "triggeredById" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_workflow_executions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_workflow_executions_projectId_createdAt_idx" ON "ai_workflow_executions"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "ai_workflow_executions_status_idx" ON "ai_workflow_executions"("status");

ALTER TABLE "ai_workflow_executions"
  ADD CONSTRAINT "ai_workflow_executions_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable ai_runs
ALTER TABLE "ai_runs" ADD COLUMN IF NOT EXISTS "workflowId" TEXT;

CREATE INDEX IF NOT EXISTS "ai_runs_workflowId_idx" ON "ai_runs"("workflowId");

ALTER TABLE "ai_runs"
  ADD CONSTRAINT "ai_runs_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "ai_workflow_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
