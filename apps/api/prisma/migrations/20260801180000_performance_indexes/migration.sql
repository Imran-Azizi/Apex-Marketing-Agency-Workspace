-- Performance indexes for hot list/auth/filter paths.
-- Additive only — no data or behavior changes.

CREATE INDEX IF NOT EXISTS "crm_customers_deletedAt_idx" ON "crm_customers"("deletedAt");
CREATE INDEX IF NOT EXISTS "crm_customers_salesOwnerId_idx" ON "crm_customers"("salesOwnerId");
CREATE INDEX IF NOT EXISTS "crm_customers_nextFollowUpAt_idx" ON "crm_customers"("nextFollowUpAt");

CREATE INDEX IF NOT EXISTS "opportunities_deletedAt_idx" ON "opportunities"("deletedAt");

CREATE INDEX IF NOT EXISTS "users_deletedAt_idx" ON "users"("deletedAt");
CREATE INDEX IF NOT EXISTS "users_roleId_idx" ON "users"("roleId");
CREATE INDEX IF NOT EXISTS "users_isActive_deletedAt_idx" ON "users"("isActive", "deletedAt");

CREATE INDEX IF NOT EXISTS "projects_deletedAt_idx" ON "projects"("deletedAt");
CREATE INDEX IF NOT EXISTS "projects_deletedAt_status_idx" ON "projects"("deletedAt", "status");
CREATE INDEX IF NOT EXISTS "projects_customerFacingStatus_idx" ON "projects"("customerFacingStatus");
CREATE INDEX IF NOT EXISTS "projects_portalAccountId_idx" ON "projects"("portalAccountId");

CREATE INDEX IF NOT EXISTS "invoices_opportunityId_idx" ON "invoices"("opportunityId");
CREATE INDEX IF NOT EXISTS "invoices_projectId_idx" ON "invoices"("projectId");
CREATE INDEX IF NOT EXISTS "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");

CREATE INDEX IF NOT EXISTS "notifications_portalAccountId_isRead_idx" ON "notifications"("portalAccountId", "isRead");
CREATE INDEX IF NOT EXISTS "notifications_createdAt_idx" ON "notifications"("createdAt");
CREATE INDEX IF NOT EXISTS "content_versions_publishedToClient_idx" ON "content_versions"("publishedToClient");
