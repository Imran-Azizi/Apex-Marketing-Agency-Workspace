-- Store method-specific payment details (Hesab Pay account, office address, etc.)
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "methodMeta" JSONB;
