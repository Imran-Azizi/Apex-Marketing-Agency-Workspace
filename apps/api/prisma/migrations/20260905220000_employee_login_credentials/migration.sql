-- Recoverable encrypted employee login passwords for authorized managers.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordCipher" TEXT;

INSERT INTO "permissions" ("id", "code", "description", "createdAt")
VALUES
  ('rbac_employees_credentials', 'employees.credentials', 'مشاهده اطلاعات ورود کارمند', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" IN ('MANAGER', 'ADMIN')
  AND p."code" = 'employees.credentials'
ON CONFLICT DO NOTHING;
