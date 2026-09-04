-- Ensure SALES role has core CRM and contact permissions in role_permissions.
-- Catalog defaults exist in code but may be missing from DB for existing deployments.

INSERT INTO "permissions" ("id", "code", "description", "createdAt")
VALUES
  ('rbac_crm_view_seed', 'crm.view', 'مشاهده مشتریان', CURRENT_TIMESTAMP),
  ('rbac_contact_view_seed', 'contact.view', 'مشاهده پیام‌های فرم تماس', CURRENT_TIMESTAMP),
  ('rbac_contact_edit_seed', 'contact.edit', 'ویرایش پیام‌های تماس', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" = 'SALES'
  AND p."code" IN ('crm.view', 'contact.view', 'contact.edit')
ON CONFLICT DO NOTHING;
