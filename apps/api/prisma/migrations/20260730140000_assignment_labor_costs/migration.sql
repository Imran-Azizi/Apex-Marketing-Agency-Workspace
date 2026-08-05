-- Store manager-entered labor costs on assignment records (historical snapshot per task)
ALTER TABLE "narration_tasks" ADD COLUMN "assignedAmount" DECIMAL(14,2);

ALTER TABLE "editing_tasks" ADD COLUMN "assignedAmount" DECIMAL(14,2);
