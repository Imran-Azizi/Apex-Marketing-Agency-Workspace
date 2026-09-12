-- Additive indexes for public website list queries.
-- No data or behavior changes.

CREATE INDEX IF NOT EXISTS "services_isPublished_deletedAt_sortOrder_idx"
  ON "services"("isPublished", "deletedAt", "sortOrder");

CREATE INDEX IF NOT EXISTS "portfolio_items_deletedAt_status_idx"
  ON "portfolio_items"("deletedAt", "status");
