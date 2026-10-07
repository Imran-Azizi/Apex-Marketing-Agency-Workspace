-- Store method-specific details for company expenses (same shape as CRM payments)
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "paymentMethodMeta" JSONB;
