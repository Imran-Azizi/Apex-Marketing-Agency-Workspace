-- Seed Task Management permissions and attach to roles.

INSERT INTO "permissions" ("id", "code", "description", "createdAt")
VALUES
  ('rbac_tasks_view', 'tasks.view', 'مشاهده وظایف', CURRENT_TIMESTAMP),
  ('rbac_tasks_create', 'tasks.create', 'ایجاد و تخصیص وظیفه', CURRENT_TIMESTAMP),
  ('rbac_tasks_edit', 'tasks.edit', 'ویرایش وظیفه', CURRENT_TIMESTAMP),
  ('rbac_tasks_manage', 'tasks.manage', 'تأیید و نظارت وظایف', CURRENT_TIMESTAMP),
  ('rbac_tasks_delete', 'tasks.delete', 'حذف وظیفه', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Managers / Admins: full task access
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" IN ('MANAGER', 'ADMIN')
  AND p."code" IN ('tasks.view', 'tasks.create', 'tasks.edit', 'tasks.manage', 'tasks.delete')
ON CONFLICT DO NOTHING;

-- Project managers: create/edit/manage + view
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" = 'PROJECT_MANAGER'
  AND p."code" IN ('tasks.view', 'tasks.create', 'tasks.edit', 'tasks.manage')
ON CONFLICT DO NOTHING;

-- All other staff: view own tasks
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" IN ('SALES', 'EDITOR', 'NARRATOR', 'FINANCE')
  AND p."code" = 'tasks.view'
ON CONFLICT DO NOTHING;
