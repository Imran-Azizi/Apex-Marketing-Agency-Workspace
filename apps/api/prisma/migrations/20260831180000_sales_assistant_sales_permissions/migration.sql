-- Grant Sales role full Sales Assistant access (view, act, configure).
-- Permissions exist in catalog defaults but were never seeded for SALES in role_permissions.

INSERT INTO "permissions" ("id", "code", "description", "createdAt")
VALUES
  ('rbac_sales_assistant_view', 'sales_assistant.view', 'مشاهده دستیار فروش', CURRENT_TIMESTAMP),
  ('rbac_sales_assistant_act', 'sales_assistant.act', 'اقدام روی توصیه‌های دستیار فروش', CURRENT_TIMESTAMP),
  ('rbac_sales_assistant_manage', 'sales_assistant.manage', 'پیکربندی دستیار فروش', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" IN ('MANAGER', 'ADMIN')
  AND p."code" IN ('sales_assistant.view', 'sales_assistant.act', 'sales_assistant.manage')
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" = 'SALES'
  AND p."code" IN ('sales_assistant.view', 'sales_assistant.act', 'sales_assistant.manage')
ON CONFLICT DO NOTHING;
