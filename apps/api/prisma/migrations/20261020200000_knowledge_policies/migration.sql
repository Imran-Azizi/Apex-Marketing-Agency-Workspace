-- CreateEnum
CREATE TYPE "KnowledgeKind" AS ENUM ('EXPERIENCE', 'POLICY');

-- AlterTable
ALTER TABLE "knowledge_entries" ADD COLUMN "kind" "KnowledgeKind" NOT NULL DEFAULT 'EXPERIENCE';
ALTER TABLE "knowledge_entries" ADD COLUMN "version" TEXT;

-- CreateIndex
CREATE INDEX "knowledge_entries_kind_roleAudience_status_deletedAt_idx" ON "knowledge_entries"("kind", "roleAudience", "status", "deletedAt");

-- Seed policy management permission
INSERT INTO "permissions" ("id", "code", "description", "createdAt")
VALUES
  ('rbac_knowledge_manage', 'knowledge.manage', 'مدیریت پالیسی‌های رسمی شرکت', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" IN ('MANAGER', 'ADMIN')
  AND p."code" = 'knowledge.manage'
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" = 'PROJECT_MANAGER'
  AND p."code" = 'knowledge.manage'
ON CONFLICT DO NOTHING;
