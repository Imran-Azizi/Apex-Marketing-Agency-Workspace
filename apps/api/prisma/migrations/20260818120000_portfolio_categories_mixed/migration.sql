-- Make project/video optional so standalone manager uploads are allowed
ALTER TABLE "portfolio_items" ALTER COLUMN "projectId" DROP NOT NULL;
ALTER TABLE "portfolio_items" ALTER COLUMN "videoFileId" DROP NOT NULL;
ALTER TABLE "portfolio_items" ALTER COLUMN "description" DROP NOT NULL;

ALTER TABLE "portfolio_items" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;
ALTER TABLE "portfolio_items" ADD COLUMN IF NOT EXISTS "thumbnailKey" TEXT;
ALTER TABLE "portfolio_items" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS "portfolio_items_projectId_active_key";
CREATE UNIQUE INDEX "portfolio_items_projectId_active_key"
  ON "portfolio_items"("projectId")
  WHERE "deletedAt" IS NULL AND "projectId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "portfolio_items_sortOrder_idx" ON "portfolio_items"("sortOrder");

-- Categories
CREATE TABLE "portfolio_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "portfolio_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "portfolio_categories_slug_key" ON "portfolio_categories"("slug");
CREATE INDEX "portfolio_categories_isActive_sortOrder_idx" ON "portfolio_categories"("isActive", "sortOrder");
CREATE INDEX "portfolio_categories_deletedAt_idx" ON "portfolio_categories"("deletedAt");

CREATE TABLE "portfolio_item_categories" (
    "itemId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "portfolio_item_categories_pkey" PRIMARY KEY ("itemId", "categoryId")
);

CREATE INDEX "portfolio_item_categories_categoryId_sortOrder_idx"
  ON "portfolio_item_categories"("categoryId", "sortOrder");

ALTER TABLE "portfolio_item_categories"
  ADD CONSTRAINT "portfolio_item_categories_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "portfolio_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "portfolio_item_categories"
  ADD CONSTRAINT "portfolio_item_categories_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "portfolio_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "mixed_portfolio_items" (
    "itemId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mixed_portfolio_items_pkey" PRIMARY KEY ("itemId")
);

CREATE INDEX "mixed_portfolio_items_sortOrder_idx" ON "mixed_portfolio_items"("sortOrder");

ALTER TABLE "mixed_portfolio_items"
  ADD CONSTRAINT "mixed_portfolio_items_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "portfolio_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed predefined public categories (Mixed is not a row)
INSERT INTO "portfolio_categories" ("id", "name", "slug", "sortOrder", "isActive", "isSystem", "createdAt", "updatedAt")
VALUES
  ('pcat_beverages', 'محصولات نوشیدنی', 'beverages', 1, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pcat_cosmetics', 'محصولات آرایشی و بهداشتی', 'cosmetics', 2, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pcat_services', 'شرکت های خدماتی', 'service-companies', 3, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pcat_transport', 'شرکت های ترانسپورتی', 'transport', 4, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pcat_food', 'محصولات خوراکی', 'food', 5, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pcat_agriculture', 'محصولات زراعتی', 'agriculture', 6, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
