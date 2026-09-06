-- Facebook-style unseen highlight: seenAt is independent of isRead.
-- Already-read rows are marked seen. Unread rows stay unseen so they
-- highlight once the next time the recipient opens the sidebar.
ALTER TABLE "notifications" ADD COLUMN "seenAt" TIMESTAMP(3);

UPDATE "notifications"
SET "seenAt" = COALESCE("readAt", "createdAt")
WHERE "isRead" = true AND "seenAt" IS NULL;

CREATE INDEX "notifications_userId_seenAt_idx" ON "notifications"("userId", "seenAt");
CREATE INDEX "notifications_portalAccountId_seenAt_idx" ON "notifications"("portalAccountId", "seenAt");
