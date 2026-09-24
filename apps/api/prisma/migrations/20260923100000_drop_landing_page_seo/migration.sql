-- Drop SEO / page-settings columns from landing_pages
ALTER TABLE "landing_pages" DROP COLUMN IF EXISTS "seoTitle";
ALTER TABLE "landing_pages" DROP COLUMN IF EXISTS "seoDescription";
ALTER TABLE "landing_pages" DROP COLUMN IF EXISTS "seoKeywords";
ALTER TABLE "landing_pages" DROP COLUMN IF EXISTS "ogTitle";
ALTER TABLE "landing_pages" DROP COLUMN IF EXISTS "ogDescription";
ALTER TABLE "landing_pages" DROP COLUMN IF EXISTS "ogImageKey";
ALTER TABLE "landing_pages" DROP COLUMN IF EXISTS "canonicalUrl";
