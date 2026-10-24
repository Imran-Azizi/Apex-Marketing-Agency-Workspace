-- AlterTable
ALTER TABLE "salary_payments" ADD COLUMN IF NOT EXISTS "paymentMethodMeta" JSONB;

-- AlterTable
ALTER TABLE "salary_advances" ADD COLUMN IF NOT EXISTS "paymentMethodMeta" JSONB;
