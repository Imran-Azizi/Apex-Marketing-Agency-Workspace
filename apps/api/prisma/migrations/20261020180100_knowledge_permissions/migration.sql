-- Seed Knowledge (peer experience) permissions.

INSERT INTO "permissions" ("id", "code", "description", "createdAt")
VALUES
  ('rbac_knowledge_view', 'knowledge.view', 'مشاهده دانش نقش خود', CURRENT_TIMESTAMP),
  ('rbac_knowledge_create', 'knowledge.create', 'ثبت و اشتراک تجربه کاری', CURRENT_TIMESTAMP),
  ('rbac_knowledge_edit', 'knowledge.edit', 'ویرایش دانش خود', CURRENT_TIMESTAMP),
  ('rbac_knowledge_delete', 'knowledge.delete', 'حذف دانش', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Managers / Admins: full
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" IN ('MANAGER', 'ADMIN')
  AND p."code" IN ('knowledge.view', 'knowledge.create', 'knowledge.edit', 'knowledge.delete')
ON CONFLICT DO NOTHING;

-- All internal staff: view + create + edit own
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" IN ('SALES', 'EDITOR', 'NARRATOR', 'FINANCE', 'PROJECT_MANAGER')
  AND p."code" IN ('knowledge.view', 'knowledge.create', 'knowledge.edit')
ON CONFLICT DO NOTHING;
