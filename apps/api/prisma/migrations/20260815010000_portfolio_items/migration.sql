-- CreateEnum
CREATE TYPE "PortfolioStatus" AS ENUM ('PUBLISHED', 'UNPUBLISHED');

-- CreateTable
CREATE TABLE "portfolio_items" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "videoFileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "PortfolioStatus" NOT NULL DEFAULT 'PUBLISHED',
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "portfolio_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_items_slug_key" ON "portfolio_items"("slug");

-- One active portfolio entry per project (soft-deleted rows can be restored/replaced)
CREATE UNIQUE INDEX "portfolio_items_projectId_active_key"
  ON "portfolio_items"("projectId")
  WHERE "deletedAt" IS NULL;

-- CreateIndex
CREATE INDEX "portfolio_items_status_publishedAt_idx" ON "portfolio_items"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "portfolio_items_projectId_idx" ON "portfolio_items"("projectId");

-- CreateIndex
CREATE INDEX "portfolio_items_videoFileId_idx" ON "portfolio_items"("videoFileId");

-- CreateIndex
CREATE INDEX "portfolio_items_deletedAt_idx" ON "portfolio_items"("deletedAt");

-- AddForeignKey
ALTER TABLE "portfolio_items"
  ADD CONSTRAINT "portfolio_items_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "portfolio_items"
  ADD CONSTRAINT "portfolio_items_videoFileId_fkey"
  FOREIGN KEY ("videoFileId") REFERENCES "project_files"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "portfolio_items"
  ADD CONSTRAINT "portfolio_items_publishedById_fkey"
  FOREIGN KEY ("publishedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Ensure RBAC permission rows exist (Manager/Admin still full-access by role)
INSERT INTO "permissions" ("id", "code", "description", "createdAt")
VALUES
  ('perm_portfolio_view', 'portfolio.view', 'portfolio.view', CURRENT_TIMESTAMP),
  ('perm_portfolio_publish', 'portfolio.publish', 'portfolio.publish', CURRENT_TIMESTAMP),
  ('perm_portfolio_edit', 'portfolio.edit', 'portfolio.edit', CURRENT_TIMESTAMP),
  ('perm_portfolio_delete', 'portfolio.delete', 'portfolio.delete', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code IN ('MANAGER', 'ADMIN')
  AND p.code IN ('portfolio.view', 'portfolio.publish', 'portfolio.edit', 'portfolio.delete')
ON CONFLICT DO NOTHING;
