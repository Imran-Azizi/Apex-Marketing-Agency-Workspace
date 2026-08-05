-- Remove n8n-specific columns from AI tables
ALTER TABLE "ai_agents" DROP COLUMN IF EXISTS "n8nWebhookPath";
ALTER TABLE "ai_workflow_executions" DROP COLUMN IF EXISTS "n8nExecutionId";
