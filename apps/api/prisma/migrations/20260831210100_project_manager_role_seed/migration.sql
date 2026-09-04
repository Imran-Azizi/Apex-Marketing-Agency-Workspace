-- Seed Project Manager role and minimal default permissions.

INSERT INTO "roles" ("id", "code", "name", "description", "createdAt", "updatedAt")
SELECT 'role_project_manager', 'PROJECT_MANAGER', 'مدیر پروژه', 'مدیریت پروژه‌های تولید', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "code" = 'PROJECT_MANAGER');

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" = 'PROJECT_MANAGER'
  AND p."code" IN (
    'dashboard.view',
    'projects.view',
    'projects.edit',
    'projects.assign',
    'projects.complete',
    'content.view',
    'chat.view',
    'chat.send',
    'chat.upload',
    'dashboard:view',
    'notification:read',
    'project:read',
    'project:write',
    'project:start'
  )
ON CONFLICT DO NOTHING;
