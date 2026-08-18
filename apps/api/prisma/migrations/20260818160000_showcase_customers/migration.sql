-- CreateTable
CREATE TABLE "showcase_customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "description" TEXT,
    "imageKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "showcase_customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "showcase_customers_isPublished_sortOrder_idx" ON "showcase_customers"("isPublished", "sortOrder");

-- CreateIndex
CREATE INDEX "showcase_customers_deletedAt_idx" ON "showcase_customers"("deletedAt");

-- CreateIndex
CREATE INDEX "showcase_customers_sortOrder_idx" ON "showcase_customers"("sortOrder");

-- Showcase customer permissions
INSERT INTO "permissions" ("id", "code", "description", "createdAt")
VALUES
  ('rbac_customers_view', 'customers.view', 'مشاهده مشتریان وب‌سایت عمومی در پنل', CURRENT_TIMESTAMP),
  ('rbac_customers_create', 'customers.create', 'ایجاد مشتری جدید و بارگذاری تصویر', CURRENT_TIMESTAMP),
  ('rbac_customers_edit', 'customers.edit', 'ویرایش، ترتیب، انتشار و جایگزینی تصویر مشتری', CURRENT_TIMESTAMP),
  ('rbac_customers_delete', 'customers.delete', 'حذف مشتری', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" IN ('MANAGER', 'ADMIN')
  AND p."code" IN ('customers.view', 'customers.create', 'customers.edit', 'customers.delete')
ON CONFLICT DO NOTHING;
