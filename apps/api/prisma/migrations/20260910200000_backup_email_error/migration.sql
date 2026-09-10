-- Track soft email-delivery failures without failing the backup itself.

ALTER TABLE "system_backups" ADD COLUMN IF NOT EXISTS "emailError" TEXT;
