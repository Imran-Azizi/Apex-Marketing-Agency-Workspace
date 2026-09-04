-- Business Assistant Agent tables

CREATE TABLE "business_assistant_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "weeklyReportEnabled" BOOLEAN NOT NULL DEFAULT true,
    "weeklyReportDay" INTEGER NOT NULL DEFAULT 1,
    "weeklyReportHour" INTEGER NOT NULL DEFAULT 8,
    "weeklyReportMinute" INTEGER NOT NULL DEFAULT 0,
    "receivableAlertPct" INTEGER NOT NULL DEFAULT 30,
    "overdueProjectDays" INTEGER NOT NULL DEFAULT 3,
    "profitTargetGapPct" INTEGER NOT NULL DEFAULT 15,
    "pipelineStuckDays" INTEGER NOT NULL DEFAULT 7,
    "notifyManagerOnHigh" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "business_assistant_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_assistant_insights" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'COMPANY',
    "priority" TEXT NOT NULL,
    "actionState" TEXT NOT NULL DEFAULT 'NEW',
    "fingerprint" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "strengthOrWeakness" TEXT,
    "recommendedAction" TEXT NOT NULL,
    "actionPlan" TEXT,
    "weeklyStrategy" TEXT,
    "facts" JSONB,
    "evidence" JSONB,
    "aiModel" TEXT,
    "aiPromptVersion" TEXT,
    "usedAi" BOOLEAN NOT NULL DEFAULT false,
    "actedAt" TIMESTAMP(3),
    "actedById" TEXT,
    "actionTaken" TEXT,
    "actionNotes" TEXT,
    "viewedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_assistant_insights_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_assistant_weekly_reports" (
    "id" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" JSONB NOT NULL,
    "snapshot" JSONB NOT NULL,
    "strategies" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_assistant_weekly_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_assistant_monthly_targets" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "targets" JSONB NOT NULL,
    "aiRecommendation" JSONB,
    "managerNotes" TEXT,
    "progress" JSONB,
    "createdById" TEXT NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_assistant_monthly_targets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_assistant_chat_messages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contextSnapshot" JSONB,
    "usedAi" BOOLEAN NOT NULL DEFAULT false,
    "aiModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_assistant_chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_assistant_runs" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "stats" JSONB,
    "error" TEXT,

    CONSTRAINT "business_assistant_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "business_assistant_weekly_reports_weekStart_key" ON "business_assistant_weekly_reports"("weekStart");
CREATE INDEX "business_assistant_weekly_reports_weekStart_idx" ON "business_assistant_weekly_reports"("weekStart");
CREATE UNIQUE INDEX "business_assistant_monthly_targets_year_month_key" ON "business_assistant_monthly_targets"("year", "month");
CREATE INDEX "business_assistant_monthly_targets_year_month_idx" ON "business_assistant_monthly_targets"("year", "month");
CREATE INDEX "business_assistant_insights_actionState_priority_idx" ON "business_assistant_insights"("actionState", "priority");
CREATE INDEX "business_assistant_insights_category_priority_idx" ON "business_assistant_insights"("category", "priority");
CREATE INDEX "business_assistant_insights_kind_idx" ON "business_assistant_insights"("kind");
CREATE INDEX "business_assistant_insights_fingerprint_idx" ON "business_assistant_insights"("fingerprint");
CREATE INDEX "business_assistant_insights_createdAt_idx" ON "business_assistant_insights"("createdAt");
CREATE INDEX "business_assistant_insights_supersededAt_idx" ON "business_assistant_insights"("supersededAt");
CREATE INDEX "business_assistant_chat_messages_userId_createdAt_idx" ON "business_assistant_chat_messages"("userId", "createdAt");
CREATE INDEX "business_assistant_runs_startedAt_idx" ON "business_assistant_runs"("startedAt");
CREATE INDEX "business_assistant_runs_trigger_startedAt_idx" ON "business_assistant_runs"("trigger", "startedAt");

ALTER TABLE "business_assistant_settings" ADD CONSTRAINT "business_assistant_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "business_assistant_insights" ADD CONSTRAINT "business_assistant_insights_actedById_fkey" FOREIGN KEY ("actedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "business_assistant_monthly_targets" ADD CONSTRAINT "business_assistant_monthly_targets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_assistant_chat_messages" ADD CONSTRAINT "business_assistant_chat_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "business_assistant_settings" ("id", "enabled", "weeklyReportEnabled", "weeklyReportDay", "weeklyReportHour", "weeklyReportMinute", "receivableAlertPct", "overdueProjectDays", "profitTargetGapPct", "pipelineStuckDays", "notifyManagerOnHigh", "updatedAt")
VALUES ('default', true, true, 1, 8, 0, 30, 3, 15, 7, true, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
