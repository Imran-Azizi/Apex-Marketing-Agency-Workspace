-- Additive indexes for hot list / KPI / portal paths.
-- No data or behavior changes.

CREATE INDEX IF NOT EXISTS "projects_deletedAt_updatedAt_idx"
  ON "projects"("deletedAt", "updatedAt");

CREATE INDEX IF NOT EXISTS "crm_customers_deletedAt_updatedAt_idx"
  ON "crm_customers"("deletedAt", "updatedAt");

CREATE INDEX IF NOT EXISTS "payments_verification_paidAt_idx"
  ON "payments"("verification", "paidAt");

CREATE INDEX IF NOT EXISTS "content_versions_publishedToClient_isLocked_idx"
  ON "content_versions"("publishedToClient", "isLocked");
