-- Drop analysis snapshot column (advertising-budget analysis feature removed)
ALTER TABLE "finance_pnl_targets" DROP COLUMN IF EXISTS "lastAnalysis";
