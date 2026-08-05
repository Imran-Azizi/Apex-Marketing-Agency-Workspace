-- Trim AI Workspace agents to Scenario → Narration → Storyboard only.

-- Remove historical runs and agent rows for obsolete agents.
DELETE FROM "ai_runs"
WHERE "agentType"::text IN (
  'SALES_ASSISTANT', 'INTAKE', 'QC', 'PORTFOLIO', 'PROJECT_ASSISTANT'
);

DELETE FROM "ai_agents"
WHERE "code"::text IN (
  'SALES_ASSISTANT', 'INTAKE', 'QC', 'PORTFOLIO', 'PROJECT_ASSISTANT'
);

-- Strip obsolete agent payloads from content version extras (keep provider metadata).
UPDATE "content_versions"
SET "extras" = ("extras"::jsonb)
  - 'sales'
  - 'intake'
  - 'qc'
  - 'portfolio'
  - 'assistant'
WHERE "extras" IS NOT NULL;

-- Recreate enum with only content-production agents.
CREATE TYPE "AiAgentType_new" AS ENUM ('SCENARIO', 'NARRATION', 'STORYBOARD');

ALTER TABLE "ai_runs"
  ALTER COLUMN "agentType" TYPE "AiAgentType_new"
  USING ("agentType"::text::"AiAgentType_new");

ALTER TABLE "ai_agents"
  ALTER COLUMN "code" TYPE "AiAgentType_new"
  USING ("code"::text::"AiAgentType_new");

DROP TYPE "AiAgentType";
ALTER TYPE "AiAgentType_new" RENAME TO "AiAgentType";
