-- Restore Sales Assistant Agent tables

CREATE TABLE "sales_assistant_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "decisionWaitingDays" INTEGER NOT NULL DEFAULT 2,
    "pendingDepositDays" INTEGER NOT NULL DEFAULT 1,
    "repeatOrderMinDays" INTEGER NOT NULL DEFAULT 45,
    "repeatOrderMaxDays" INTEGER NOT NULL DEFAULT 180,
    "skipIfActiveHours" INTEGER NOT NULL DEFAULT 18,
    "dailyReportEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dailyReportHour" INTEGER NOT NULL DEFAULT 8,
    "dailyReportMinute" INTEGER NOT NULL DEFAULT 0,
    "notifyRepOnHigh" BOOLEAN NOT NULL DEFAULT true,
    "notifyManagerOnHigh" BOOLEAN NOT NULL DEFAULT true,
    "highValueMinOrders" INTEGER NOT NULL DEFAULT 2,
    "scanIntervalHours" INTEGER NOT NULL DEFAULT 6,
    "priorityRules" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "sales_assistant_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales_assistant_recommendations" (
    "id" TEXT NOT NULL,
    "crmCustomerId" TEXT NOT NULL,
    "salesOwnerId" TEXT,
    "kind" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "actionState" TEXT NOT NULL DEFAULT 'NEW',
    "fingerprint" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "whatHappened" TEXT,
    "customerWants" TEXT,
    "whatsStopping" TEXT,
    "recommendedAction" TEXT NOT NULL,
    "suggestedMessage" TEXT,
    "salesApproach" TEXT,
    "closeHelp" TEXT,
    "facts" JSONB,
    "interpretations" JSONB,
    "evidence" JSONB,
    "pipelineStage" TEXT NOT NULL,
    "daysInStage" DECIMAL(8,2),
    "lastInteractionAt" TIMESTAMP(3),
    "intentLevel" TEXT,
    "aiModel" TEXT,
    "aiPromptVersion" TEXT,
    "usedAi" BOOLEAN NOT NULL DEFAULT false,
    "actedAt" TIMESTAMP(3),
    "actedById" TEXT,
    "actionTaken" TEXT,
    "actionNotes" TEXT,
    "viewedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "supersededById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_assistant_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales_assistant_daily_reports" (
    "id" TEXT NOT NULL,
    "reportDate" DATE NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" JSONB NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_assistant_daily_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales_assistant_runs" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "eventType" TEXT,
    "customerId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "stats" JSONB,
    "error" TEXT,

    CONSTRAINT "sales_assistant_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_assistant_daily_reports_reportDate_key" ON "sales_assistant_daily_reports"("reportDate");

CREATE INDEX "sales_assistant_recommendations_crmCustomerId_actionState_idx" ON "sales_assistant_recommendations"("crmCustomerId", "actionState");
CREATE INDEX "sales_assistant_recommendations_crmCustomerId_kind_idx" ON "sales_assistant_recommendations"("crmCustomerId", "kind");
CREATE INDEX "sales_assistant_recommendations_salesOwnerId_actionState_idx" ON "sales_assistant_recommendations"("salesOwnerId", "actionState");
CREATE INDEX "sales_assistant_recommendations_category_priority_idx" ON "sales_assistant_recommendations"("category", "priority");
CREATE INDEX "sales_assistant_recommendations_fingerprint_idx" ON "sales_assistant_recommendations"("fingerprint");
CREATE INDEX "sales_assistant_recommendations_createdAt_idx" ON "sales_assistant_recommendations"("createdAt");
CREATE INDEX "sales_assistant_recommendations_supersededAt_idx" ON "sales_assistant_recommendations"("supersededAt");
CREATE INDEX "sales_assistant_daily_reports_reportDate_idx" ON "sales_assistant_daily_reports"("reportDate");
CREATE INDEX "sales_assistant_runs_startedAt_idx" ON "sales_assistant_runs"("startedAt");
CREATE INDEX "sales_assistant_runs_trigger_startedAt_idx" ON "sales_assistant_runs"("trigger", "startedAt");

CREATE UNIQUE INDEX "sales_assistant_open_kind_uidx"
ON "sales_assistant_recommendations" ("crmCustomerId", "kind")
WHERE "actionState" IN ('NEW', 'VIEWED', 'IN_PROGRESS') AND "supersededAt" IS NULL;

ALTER TABLE "sales_assistant_settings"
  ADD CONSTRAINT "sales_assistant_settings_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sales_assistant_recommendations"
  ADD CONSTRAINT "sales_assistant_recommendations_crmCustomerId_fkey"
  FOREIGN KEY ("crmCustomerId") REFERENCES "crm_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sales_assistant_recommendations"
  ADD CONSTRAINT "sales_assistant_recommendations_salesOwnerId_fkey"
  FOREIGN KEY ("salesOwnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sales_assistant_recommendations"
  ADD CONSTRAINT "sales_assistant_recommendations_actedById_fkey"
  FOREIGN KEY ("actedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "sales_assistant_settings" (
  "id", "enabled", "decisionWaitingDays", "pendingDepositDays",
  "repeatOrderMinDays", "repeatOrderMaxDays", "skipIfActiveHours",
  "dailyReportEnabled", "dailyReportHour", "dailyReportMinute",
  "notifyRepOnHigh", "notifyManagerOnHigh", "highValueMinOrders",
  "scanIntervalHours", "updatedAt"
) VALUES (
  'default', true, 2, 1,
  45, 180, 18,
  true, 8, 0,
  true, true, 2,
  6, CURRENT_TIMESTAMP
);
