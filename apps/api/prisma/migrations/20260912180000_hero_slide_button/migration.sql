-- Per-slide CTA button for public hero slideshow
ALTER TABLE "hero_slides" ADD COLUMN IF NOT EXISTS "buttonEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "hero_slides" ADD COLUMN IF NOT EXISTS "buttonText" TEXT;
ALTER TABLE "hero_slides" ADD COLUMN IF NOT EXISTS "buttonDestination" TEXT;
ALTER TABLE "hero_slides" ADD COLUMN IF NOT EXISTS "buttonUrl" TEXT;
