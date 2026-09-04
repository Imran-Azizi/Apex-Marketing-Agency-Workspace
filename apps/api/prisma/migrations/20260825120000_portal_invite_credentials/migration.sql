-- Recoverable encrypted portal credentials for authorized manager assistance.
ALTER TABLE "portal_accounts" ADD COLUMN IF NOT EXISTS "passwordCipher" TEXT;
ALTER TABLE "portal_invites" ADD COLUMN IF NOT EXISTS "passwordCipher" TEXT;
