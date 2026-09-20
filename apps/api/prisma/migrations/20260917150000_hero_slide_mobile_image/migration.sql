-- Optional mobile-optimized hero crop (falls back to desktop imageKey when null).
ALTER TABLE "hero_slides" ADD COLUMN IF NOT EXISTS "mobileImageKey" TEXT;
