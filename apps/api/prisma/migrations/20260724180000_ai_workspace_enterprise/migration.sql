-- AiRun observability
ALTER TABLE "ai_runs" ADD COLUMN IF NOT EXISTS "tokenUsage" JSONB;
ALTER TABLE "ai_runs" ADD COLUMN IF NOT EXISTS "durationMs" INTEGER;

-- AI activity audit trail
CREATE TABLE IF NOT EXISTS "ai_activity_logs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "message" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_activity_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_activity_logs_projectId_createdAt_idx"
  ON "ai_activity_logs"("projectId", "createdAt");

ALTER TABLE "ai_activity_logs"
  DROP CONSTRAINT IF EXISTS "ai_activity_logs_projectId_fkey";

ALTER TABLE "ai_activity_logs"
  ADD CONSTRAINT "ai_activity_logs_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Global AI settings (prompt defaults, budgets, model overrides)
CREATE TABLE IF NOT EXISTS "ai_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_settings_key_key" ON "ai_settings"("key");
