-- Convert stored slide duration from milliseconds to 1–10 seconds
ALTER TABLE "hero_slides" ADD COLUMN "durationSeconds" INTEGER NOT NULL DEFAULT 5;

UPDATE "hero_slides"
SET "durationSeconds" = LEAST(
  10,
  GREATEST(
    1,
    CASE
      WHEN "durationMs" IS NULL THEN 5
      WHEN "durationMs" > 10 THEN ROUND("durationMs"::numeric / 1000.0)
      ELSE "durationMs"
    END
  )
)::integer;

ALTER TABLE "hero_slides" DROP COLUMN "durationMs";
ALTER TABLE "hero_slides" DROP COLUMN "primaryButtonText";
ALTER TABLE "hero_slides" DROP COLUMN "primaryButtonUrl";
ALTER TABLE "hero_slides" DROP COLUMN "secondaryButtonText";
ALTER TABLE "hero_slides" DROP COLUMN "secondaryButtonUrl";
ALTER TABLE "hero_slides" DROP COLUMN "overlayOpacity";
ALTER TABLE "hero_slides" DROP COLUMN "imagePosition";
