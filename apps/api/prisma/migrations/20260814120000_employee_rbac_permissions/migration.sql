-- Employee-specific permission overrides (grant or revoke on top of role defaults)
CREATE TABLE "user_permissions" (
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("userId","permissionId")
);

CREATE INDEX "user_permissions_userId_idx" ON "user_permissions"("userId");

ALTER TABLE "user_permissions"
  ADD CONSTRAINT "user_permissions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_permissions"
  ADD CONSTRAINT "user_permissions_permissionId_fkey"
  FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Canonical permission catalog (additive; existing colon-codes remain)
INSERT INTO "permissions" ("id", "code", "description", "createdAt")
VALUES
  ('rbac_dashboard_view', 'dashboard.view', 'مشاهده داشبورد', CURRENT_TIMESTAMP),
  ('rbac_crm_view', 'crm.view', 'مشاهده مشتریان', CURRENT_TIMESTAMP),
  ('rbac_crm_create', 'crm.create', 'ایجاد مشتری', CURRENT_TIMESTAMP),
  ('rbac_crm_edit', 'crm.edit', 'ویرایش مشتری', CURRENT_TIMESTAMP),
  ('rbac_crm_delete', 'crm.delete', 'حذف مشتری', CURRENT_TIMESTAMP),
  ('rbac_crm_merge', 'crm.merge', 'ادغام مشتری', CURRENT_TIMESTAMP),
  ('rbac_crm_opportunity', 'crm.opportunity', 'مدیریت قرارداد', CURRENT_TIMESTAMP),
  ('rbac_crm_invite', 'crm.invite', 'دعوت پورتال', CURRENT_TIMESTAMP),
  ('rbac_projects_view', 'projects.view', 'مشاهده پروژه‌ها', CURRENT_TIMESTAMP),
  ('rbac_projects_edit', 'projects.edit', 'ویرایش پروژه', CURRENT_TIMESTAMP),
  ('rbac_projects_delete', 'projects.delete', 'حذف پروژه', CURRENT_TIMESTAMP),
  ('rbac_projects_assign', 'projects.assign', 'اختصاص کارمند', CURRENT_TIMESTAMP),
  ('rbac_projects_complete', 'projects.complete', 'تکمیل پروژه', CURRENT_TIMESTAMP),
  ('rbac_content_view', 'content.view', 'مشاهده محتوا', CURRENT_TIMESTAMP),
  ('rbac_content_generate', 'content.generate', 'تولید محتوا', CURRENT_TIMESTAMP),
  ('rbac_content_edit', 'content.edit', 'ویرایش محتوا', CURRENT_TIMESTAMP),
  ('rbac_content_delete', 'content.delete', 'حذف محتوا', CURRENT_TIMESTAMP),
  ('rbac_content_approve', 'content.approve', 'تأیید داخلی محتوا', CURRENT_TIMESTAMP),
  ('rbac_narration_view', 'narration.view', 'مشاهده نریشن', CURRENT_TIMESTAMP),
  ('rbac_narration_upload', 'narration.upload', 'بارگذاری صدا', CURRENT_TIMESTAMP),
  ('rbac_narration_edit', 'narration.edit', 'ویرایش مهلت نریشن', CURRENT_TIMESTAMP),
  ('rbac_narration_revise', 'narration.revise', 'درخواست اصلاح نریشن', CURRENT_TIMESTAMP),
  ('rbac_narration_approve', 'narration.approve', 'تأیید نریشن', CURRENT_TIMESTAMP),
  ('rbac_video_view', 'video.view', 'مشاهده تدوین', CURRENT_TIMESTAMP),
  ('rbac_video_edit', 'video.edit', 'ویرایش تدوین', CURRENT_TIMESTAMP),
  ('rbac_video_upload', 'video.upload', 'بارگذاری ویدیو نهایی', CURRENT_TIMESTAMP),
  ('rbac_video_approve', 'video.approve', 'تأیید ویدیو', CURRENT_TIMESTAMP),
  ('rbac_video_send', 'video.send', 'ارسال به مشتری', CURRENT_TIMESTAMP),
  ('rbac_finance_view', 'finance.view', 'مشاهده مالی', CURRENT_TIMESTAMP),
  ('rbac_finance_create', 'finance.create', 'ثبت پرداخت', CURRENT_TIMESTAMP),
  ('rbac_finance_edit', 'finance.edit', 'ویرایش پرداخت', CURRENT_TIMESTAMP),
  ('rbac_finance_delete', 'finance.delete', 'حذف پرداخت', CURRENT_TIMESTAMP),
  ('rbac_finance_approve', 'finance.approve', 'تأیید پرداخت', CURRENT_TIMESTAMP),
  ('rbac_delivery_view', 'delivery.view', 'مشاهده تحویل', CURRENT_TIMESTAMP),
  ('rbac_delivery_allow', 'delivery.allow', 'اجازه دانلود', CURRENT_TIMESTAMP),
  ('rbac_employees_view', 'employees.view', 'مشاهده کارمندان', CURRENT_TIMESTAMP),
  ('rbac_employees_create', 'employees.create', 'ایجاد کارمند', CURRENT_TIMESTAMP),
  ('rbac_employees_edit', 'employees.edit', 'ویرایش کارمند', CURRENT_TIMESTAMP),
  ('rbac_employees_disable', 'employees.disable', 'غیرفعال‌سازی کارمند', CURRENT_TIMESTAMP),
  ('rbac_employees_delete', 'employees.delete', 'حذف کارمند', CURRENT_TIMESTAMP),
  ('rbac_backup_view', 'backup.view', 'مشاهده پشتیبان', CURRENT_TIMESTAMP),
  ('rbac_backup_create', 'backup.create', 'ایجاد پشتیبان', CURRENT_TIMESTAMP),
  ('rbac_backup_download', 'backup.download', 'دانلود پشتیبان', CURRENT_TIMESTAMP),
  ('rbac_backup_restore', 'backup.restore', 'بازیابی پشتیبان', CURRENT_TIMESTAMP),
  ('rbac_backup_delete', 'backup.delete', 'حذف پشتیبان', CURRENT_TIMESTAMP),
  ('rbac_backup_manage', 'backup.manage', 'زمان‌بندی پشتیبان', CURRENT_TIMESTAMP),
  ('rbac_settings_view', 'settings.view', 'مشاهده تنظیمات', CURRENT_TIMESTAMP),
  ('rbac_settings_edit', 'settings.edit', 'ویرایش تنظیمات', CURRENT_TIMESTAMP),
  ('rbac_settings_permissions', 'settings.permissions', 'مدیریت دسترسی‌ها', CURRENT_TIMESTAMP),
  ('rbac_audit_view', 'audit.view', 'مشاهده گزارش فعالیت', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Admin / Manager: full catalog
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "roles" r
JOIN "permissions" p ON p.code IN (
  'dashboard.view',
  'crm.view','crm.create','crm.edit','crm.delete','crm.merge','crm.opportunity','crm.invite',
  'projects.view','projects.edit','projects.delete','projects.assign','projects.complete',
  'content.view','content.generate','content.edit','content.delete','content.approve',
  'narration.view','narration.upload','narration.edit','narration.revise','narration.approve',
  'video.view','video.edit','video.upload','video.approve','video.send',
  'finance.view','finance.create','finance.edit','finance.delete','finance.approve',
  'delivery.view','delivery.allow',
  'employees.view','employees.create','employees.edit','employees.disable','employees.delete',
  'backup.view','backup.create','backup.download','backup.restore','backup.delete','backup.manage',
  'settings.view','settings.edit','settings.permissions',
  'audit.view'
)
WHERE r.code IN ('MANAGER', 'ADMIN')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Sales: current CRM / project-view / payment recording access
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "roles" r
JOIN "permissions" p ON p.code IN (
  'dashboard.view',
  'crm.view','crm.create','crm.edit','crm.delete','crm.merge','crm.opportunity','crm.invite',
  'projects.view',
  'finance.view','finance.create','finance.edit','finance.delete'
)
WHERE r.code = 'SALES'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Editor: dedicated production workspace (not manager project list)
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "roles" r
JOIN "permissions" p ON p.code IN (
  'dashboard.view',
  'video.view','video.edit','video.upload'
)
WHERE r.code = 'EDITOR'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Narrator: dedicated narration workspace
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "roles" r
JOIN "permissions" p ON p.code IN (
  'dashboard.view',
  'narration.view','narration.upload'
)
WHERE r.code = 'NARRATOR'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Finance: CRM view, payments, delivery allow, audit
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "roles" r
JOIN "permissions" p ON p.code IN (
  'dashboard.view',
  'crm.view',
  'projects.view',
  'finance.view','finance.create','finance.edit','finance.delete',
  'delivery.view','delivery.allow',
  'audit.view'
)
WHERE r.code = 'FINANCE'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Customer / AI service (no UI management; keep workflow equivalents)
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "roles" r
JOIN "permissions" p ON p.code IN ('dashboard.view', 'finance.view')
WHERE r.code = 'CUSTOMER'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "roles" r
JOIN "permissions" p ON p.code IN ('projects.view', 'content.view', 'content.generate')
WHERE r.code = 'AI_SERVICE'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
