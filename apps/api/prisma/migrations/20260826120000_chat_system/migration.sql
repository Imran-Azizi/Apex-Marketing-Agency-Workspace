-- CreateEnum
CREATE TYPE "ChatConversationType" AS ENUM ('DIRECT', 'GROUP');

-- CreateEnum
CREATE TYPE "ChatMessageType" AS ENUM ('TEXT', 'VOICE', 'IMAGE', 'FILE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ChatAttachmentKind" AS ENUM ('IMAGE', 'DOCUMENT', 'VOICE', 'AUDIO', 'OTHER');

-- CreateEnum
CREATE TYPE "ChatEmployeePolicy" AS ENUM ('DISABLED', 'ALL_EMPLOYEES', 'SAME_TEAM', 'SELECTED');

-- CreateTable
CREATE TABLE "chat_org_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "employeePolicy" "ChatEmployeePolicy" NOT NULL DEFAULT 'DISABLED',
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_org_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_employee_allow_pairs" (
    "id" TEXT NOT NULL,
    "userLowId" TEXT NOT NULL,
    "userHighId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_employee_allow_pairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_conversations" (
    "id" TEXT NOT NULL,
    "type" "ChatConversationType" NOT NULL DEFAULT 'DIRECT',
    "directKey" TEXT,
    "title" TEXT,
    "createdById" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "lastMessagePreview" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_participants" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3),
    "lastReadMessageId" TEXT,
    "mutedAt" TIMESTAMP(3),
    "pinnedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "chat_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "type" "ChatMessageType" NOT NULL DEFAULT 'TEXT',
    "body" TEXT,
    "clientMessageId" TEXT,
    "replyToId" TEXT,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_attachments" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "kind" "ChatAttachmentKind" NOT NULL DEFAULT 'OTHER',
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_message_reactions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_message_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_message_deliveries" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),

    CONSTRAINT "chat_message_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_employee_allow_pairs_userLowId_userHighId_key" ON "chat_employee_allow_pairs"("userLowId", "userHighId");

-- CreateIndex
CREATE INDEX "chat_employee_allow_pairs_userLowId_idx" ON "chat_employee_allow_pairs"("userLowId");

-- CreateIndex
CREATE INDEX "chat_employee_allow_pairs_userHighId_idx" ON "chat_employee_allow_pairs"("userHighId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_conversations_directKey_key" ON "chat_conversations"("directKey");

-- CreateIndex
CREATE INDEX "chat_conversations_lastMessageAt_idx" ON "chat_conversations"("lastMessageAt");

-- CreateIndex
CREATE INDEX "chat_conversations_deletedAt_idx" ON "chat_conversations"("deletedAt");

-- CreateIndex
CREATE INDEX "chat_conversations_type_idx" ON "chat_conversations"("type");

-- CreateIndex
CREATE UNIQUE INDEX "chat_participants_conversationId_userId_key" ON "chat_participants"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "chat_participants_userId_archivedAt_idx" ON "chat_participants"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "chat_participants_userId_pinnedAt_idx" ON "chat_participants"("userId", "pinnedAt");

-- CreateIndex
CREATE INDEX "chat_participants_conversationId_idx" ON "chat_participants"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_senderId_clientMessageId_key" ON "chat_messages"("senderId", "clientMessageId");

-- CreateIndex
CREATE INDEX "chat_messages_conversationId_createdAt_idx" ON "chat_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "chat_messages_conversationId_id_idx" ON "chat_messages"("conversationId", "id");

-- CreateIndex
CREATE INDEX "chat_messages_senderId_idx" ON "chat_messages"("senderId");

-- CreateIndex
CREATE INDEX "chat_messages_deletedAt_idx" ON "chat_messages"("deletedAt");

-- CreateIndex
CREATE INDEX "chat_attachments_messageId_idx" ON "chat_attachments"("messageId");

-- CreateIndex
CREATE INDEX "chat_attachments_storageKey_idx" ON "chat_attachments"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "chat_message_reactions_messageId_userId_emoji_key" ON "chat_message_reactions"("messageId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "chat_message_reactions_messageId_idx" ON "chat_message_reactions"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_message_deliveries_messageId_userId_key" ON "chat_message_deliveries"("messageId", "userId");

-- CreateIndex
CREATE INDEX "chat_message_deliveries_userId_readAt_idx" ON "chat_message_deliveries"("userId", "readAt");

-- CreateIndex
CREATE INDEX "chat_message_deliveries_messageId_idx" ON "chat_message_deliveries"("messageId");

-- AddForeignKey
ALTER TABLE "chat_org_settings" ADD CONSTRAINT "chat_org_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_employee_allow_pairs" ADD CONSTRAINT "chat_employee_allow_pairs_userLowId_fkey" FOREIGN KEY ("userLowId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_employee_allow_pairs" ADD CONSTRAINT "chat_employee_allow_pairs_userHighId_fkey" FOREIGN KEY ("userHighId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_employee_allow_pairs" ADD CONSTRAINT "chat_employee_allow_pairs_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_participants" ADD CONSTRAINT "chat_participants_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_participants" ADD CONSTRAINT "chat_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message_reactions" ADD CONSTRAINT "chat_message_reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message_reactions" ADD CONSTRAINT "chat_message_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message_deliveries" ADD CONSTRAINT "chat_message_deliveries_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message_deliveries" ADD CONSTRAINT "chat_message_deliveries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default org settings (employee-to-employee chat disabled)
INSERT INTO "chat_org_settings" ("id", "employeePolicy", "createdAt", "updatedAt")
VALUES ('default', 'DISABLED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Chat RBAC permissions
INSERT INTO "permissions" ("id", "code", "description", "createdAt")
VALUES
  ('rbac_chat_view', 'chat.view', 'مشاهده گفتگوی داخلی', CURRENT_TIMESTAMP),
  ('rbac_chat_send', 'chat.send', 'ارسال پیام در گفتگوی داخلی', CURRENT_TIMESTAMP),
  ('rbac_chat_upload', 'chat.upload', 'بارگذاری فایل و صوت در گفتگو', CURRENT_TIMESTAMP),
  ('rbac_chat_manage', 'chat.manage', 'مدیریت دسترسی گفتگوی کارمندان', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Manager / Admin: all chat permissions
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code IN ('MANAGER', 'ADMIN')
  AND p.code IN ('chat.view', 'chat.send', 'chat.upload', 'chat.manage')
ON CONFLICT DO NOTHING;

-- Staff defaults: view/send/upload (not manage)
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code IN ('SALES', 'EDITOR', 'NARRATOR', 'FINANCE')
  AND p.code IN ('chat.view', 'chat.send', 'chat.upload')
ON CONFLICT DO NOTHING;
