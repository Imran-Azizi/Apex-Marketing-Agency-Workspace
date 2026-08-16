INSERT INTO "permissions" ("id", "code", "description", "createdAt")
VALUES
  ('rbac_services_view', 'services.view', 'مشاهده فهرست خدمات در پنل', CURRENT_TIMESTAMP),
  ('rbac_services_create', 'services.create', 'ایجاد خدمت جدید', CURRENT_TIMESTAMP),
  ('rbac_services_edit', 'services.edit', 'ویرایش، ترتیب و انتشار خدمات', CURRENT_TIMESTAMP),
  ('rbac_services_delete', 'services.delete', 'حذف نرم خدمت', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
