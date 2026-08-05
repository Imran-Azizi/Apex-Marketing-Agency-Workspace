-- Remove project visual style and portfolio permission fields
ALTER TABLE "projects" DROP COLUMN IF EXISTS "styleId";
ALTER TABLE "projects" DROP COLUMN IF EXISTS "portfolioPermission";
DROP TYPE IF EXISTS "public"."PortfolioPermission";
