-- Remove unused OrderType feature (ad topic type)
ALTER TABLE "projects" DROP COLUMN IF EXISTS "orderType";
DROP TYPE IF EXISTS "public"."OrderType";
