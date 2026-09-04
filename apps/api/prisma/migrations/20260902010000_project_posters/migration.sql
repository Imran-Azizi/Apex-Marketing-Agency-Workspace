-- Project poster workflow: versioned files, manager review, customer delivery.

ALTER TYPE "FileKind" ADD VALUE IF NOT EXISTS 'POSTER';

CREATE TYPE "PosterStatus" AS ENUM (
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'SENT_TO_CUSTOMER'
);

CREATE TABLE "project_posters" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "crmCustomerId" TEXT NOT NULL,
  "fileId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "notes" TEXT,
  "status" "PosterStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "uploadedById" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "deliveredAt" TIMESTAMP(3),
  "deliveredById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "project_posters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_posters_fileId_key" ON "project_posters"("fileId");
CREATE UNIQUE INDEX "project_posters_projectId_version_key" ON "project_posters"("projectId", "version");
CREATE INDEX "project_posters_projectId_status_idx" ON "project_posters"("projectId", "status");
CREATE INDEX "project_posters_crmCustomerId_idx" ON "project_posters"("crmCustomerId");
CREATE INDEX "project_posters_status_idx" ON "project_posters"("status");

ALTER TABLE "project_posters"
  ADD CONSTRAINT "project_posters_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_posters"
  ADD CONSTRAINT "project_posters_crmCustomerId_fkey"
  FOREIGN KEY ("crmCustomerId") REFERENCES "crm_customers"("id") ON UPDATE CASCADE;

ALTER TABLE "project_posters"
  ADD CONSTRAINT "project_posters_fileId_fkey"
  FOREIGN KEY ("fileId") REFERENCES "project_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_posters"
  ADD CONSTRAINT "project_posters_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_posters"
  ADD CONSTRAINT "project_posters_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_posters"
  ADD CONSTRAINT "project_posters_deliveredById_fkey"
  FOREIGN KEY ("deliveredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "description", "createdAt")
VALUES
  ('rbac_poster_view', 'poster.view', 'مشاهده پوسترهای پروژه', CURRENT_TIMESTAMP),
  ('rbac_poster_upload', 'poster.upload', 'بارگذاری پوستر پروژه', CURRENT_TIMESTAMP),
  ('rbac_poster_approve', 'poster.approve', 'تأیید یا رد پوستر پروژه', CURRENT_TIMESTAMP),
  ('rbac_poster_send', 'poster.send', 'ارسال پوستر تأییدشده به مشتری', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" IN ('MANAGER', 'ADMIN')
  AND p."code" IN ('poster.view', 'poster.upload', 'poster.approve', 'poster.send')
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" = 'EDITOR'
  AND p."code" IN ('poster.view', 'poster.upload')
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" = 'PROJECT_MANAGER'
  AND p."code" IN ('poster.view')
ON CONFLICT DO NOTHING;
