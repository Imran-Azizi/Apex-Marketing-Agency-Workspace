-- Baseline schema captured from the existing database (pre-CRM-simplification state).
CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "public"."ActivityType" AS ENUM ('NOTE', 'CALL', 'WHATSAPP', 'EMAIL', 'FOLLOW_UP', 'STAGE_CHANGE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."AiAgentType" AS ENUM ('SALES_ASSISTANT', 'INTAKE', 'SCENARIO', 'NARRATION', 'STORYBOARD', 'QC', 'PORTFOLIO', 'PROJECT_ASSISTANT');

-- CreateEnum
CREATE TYPE "public"."AiRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."ApprovalDecision" AS ENUM ('APPROVED', 'CHANGES_REQUESTED', 'REJECTED', 'RETURNED');

-- CreateEnum
CREATE TYPE "public"."ApprovalType" AS ENUM ('MANAGER_CONTENT', 'CLIENT_CONTENT', 'MANAGER_FINAL', 'CLIENT_FINAL', 'VOICE_ACCEPT', 'QC');

-- CreateEnum
CREATE TYPE "public"."AssignmentRole" AS ENUM ('MANAGER', 'EDITOR', 'NARRATOR', 'PROPOSED_NARRATOR');

-- CreateEnum
CREATE TYPE "public"."AvailabilityStatus" AS ENUM ('ACTIVE', 'UNAVAILABLE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "public"."ContentKind" AS ENUM ('BUNDLE', 'SCENARIO', 'NARRATION', 'STORYBOARD', 'FINAL_VIDEO');

-- CreateEnum
CREATE TYPE "public"."CrmPipelineStage" AS ENUM ('NEW_LEAD', 'CONTACTED', 'NEEDS_INFORMATION', 'INFORMATION_SENT', 'INTERESTED_QUALIFIED', 'PROPOSAL_PRICE_SENT', 'WAITING_DECISION', 'ORDER_CONFIRMED', 'DEPOSIT_PENDING', 'DEPOSIT_CONFIRMED', 'PORTAL_INVITED', 'PROJECT_CREATED', 'DELIVERED', 'REPEAT_CUSTOMER', 'LOST_CANCELED');

-- CreateEnum
CREATE TYPE "public"."CustomerFacingStatus" AS ENUM ('INFO_RECEIVED', 'PREPARING_CONTENT', 'WAITING_YOUR_APPROVAL', 'IN_PRODUCTION', 'FINAL_REVIEW', 'WAITING_PAYMENT', 'READY_DELIVERY', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."ExpenseCategory" AS ENUM ('DIRECT_PROJECT', 'COMPANY_GENERAL');

-- CreateEnum
CREATE TYPE "public"."FileKind" AS ENUM ('LOGO', 'PRODUCT_IMAGE', 'VIDEO', 'BRANDBOOK', 'CATALOG', 'REFERENCE', 'PRONUNCIATION', 'WORKING', 'WATERMARKED_FINAL', 'CLEAN_FINAL', 'THUMBNAIL', 'AUDIO', 'PROMPT_LOG', 'OTHER', 'RECEIPT', 'ATTACHMENT');

-- CreateEnum
CREATE TYPE "public"."InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."OrderType" AS ENUM ('PRODUCT', 'SERVICE');

-- CreateEnum
CREATE TYPE "public"."PayableStatus" AS ENUM ('ESTIMATED', 'CONFIRMED', 'PAID');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'HAWALA', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."PortalStatus" AS ENUM ('NOT_ELIGIBLE', 'ELIGIBLE', 'INVITED', 'REGISTERED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."PortfolioPermission" AS ENUM ('ALLOWED', 'NOT_ALLOWED', 'HIDE_CLIENT_NAME', 'PENDING');

-- CreateEnum
CREATE TYPE "public"."PortfolioStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED');

-- CreateEnum
CREATE TYPE "public"."ProjectStatus" AS ENUM ('NEW_MANAGER_REVIEW', 'CONTENT_GENERATION', 'INTERNAL_CONTENT_REVIEW', 'WAITING_CLIENT_CONTENT_APPROVAL', 'CONTENT_REVISION', 'NARRATION_RECORDING', 'PRODUCTION_EDITING', 'MANAGER_FINAL_REVIEW', 'FINAL_REVISION', 'WAITING_CLIENT_FINAL_APPROVAL', 'WAITING_PAYMENT', 'READY_TO_DOWNLOAD', 'COMPLETED', 'ON_HOLD', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."RoleCode" AS ENUM ('MANAGER', 'SALES', 'EDITOR', 'NARRATOR', 'FINANCE', 'CUSTOMER', 'AI_SERVICE');

-- CreateEnum
CREATE TYPE "public"."SessionAudience" AS ENUM ('INTERNAL', 'PORTAL');

-- CreateEnum
CREATE TYPE "public"."TeamKind" AS ENUM ('EDITOR', 'NARRATOR', 'MANAGER', 'SALES', 'FINANCE');

-- CreateEnum
CREATE TYPE "public"."VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "public"."ai_runs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "agentType" "public"."AiAgentType" NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "status" "public"."AiRunStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."approvals" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contentVersionId" TEXT,
    "type" "public"."ApprovalType" NOT NULL,
    "decision" "public"."ApprovalDecision" NOT NULL,
    "comment" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."asset_references" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clientAssetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audio_samples" (
    "id" TEXT NOT NULL,
    "teamProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" TEXT,
    "gender" TEXT,
    "tone" TEXT,
    "storageKey" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "audio_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."client_assets" (
    "id" TEXT NOT NULL,
    "crmCustomerId" TEXT NOT NULL,
    "kind" "public"."FileKind" NOT NULL,
    "name" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "client_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."client_feedback" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contentVersionId" TEXT,
    "scope" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."content_versions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "public"."ContentKind" NOT NULL DEFAULT 'BUNDLE',
    "versionNumber" INTEGER NOT NULL,
    "scenario" JSONB,
    "narration" JSONB,
    "storyboard" JSONB,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "publishedToClient" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "aiRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."crm_activities" (
    "id" TEXT NOT NULL,
    "crmCustomerId" TEXT NOT NULL,
    "type" "public"."ActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."crm_customers" (
    "id" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "companyName" TEXT,
    "jobTitle" TEXT,
    "phone" TEXT,
    "whatsappRaw" TEXT NOT NULL,
    "normalizedWhatsapp" TEXT NOT NULL,
    "city" TEXT,
    "address" TEXT,
    "email" TEXT,
    "source" TEXT,
    "interestedServiceId" TEXT,
    "salesOwnerId" TEXT,
    "pipelineStage" "public"."CrmPipelineStage" NOT NULL DEFAULT 'NEW_LEAD',
    "portalStatus" "public"."PortalStatus" NOT NULL DEFAULT 'NOT_ELIGIBLE',
    "lastContactAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "notes" TEXT,
    "lostReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "crm_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."download_history" (
    "id" TEXT NOT NULL,
    "downloadPermissionId" TEXT NOT NULL,
    "portalAccountId" TEXT,
    "signedUrlExpiresAt" TIMESTAMP(3),
    "tokenHash" TEXT,
    "revokedAt" TIMESTAMP(3),
    "downloadedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "download_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."download_permissions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT false,
    "allowedAt" TIMESTAMP(3),
    "allowedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "overrideBalance" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "download_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."employee_payables" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "teamProfileId" TEXT NOT NULL,
    "roleLabel" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "public"."PayableStatus" NOT NULL DEFAULT 'ESTIMATED',
    "paidAt" TIMESTAMP(3),
    "paymentMethod" "public"."PaymentMethod",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_payables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."expenses" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "category" "public"."ExpenseCategory" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" "public"."PaymentMethod",
    "description" TEXT,
    "receiptKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."formats" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ratio" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "crmCustomerId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "projectId" TEXT,
    "status" "public"."InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'AFN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "audience" TEXT NOT NULL DEFAULT 'INTERNAL',
    "portalAccountId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."opportunities" (
    "id" TEXT NOT NULL,
    "crmCustomerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "pipelineStage" "public"."CrmPipelineStage" NOT NULL DEFAULT 'NEW_LEAD',
    "proposedPrice" DECIMAL(14,2),
    "agreedPrice" DECIMAL(14,2),
    "agreedTerms" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'AFN',
    "serviceId" TEXT,
    "lostReason" TEXT,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."otp_codes" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "portalInviteId" TEXT,
    "portalAccountId" TEXT,
    "purpose" TEXT NOT NULL DEFAULT 'REGISTER',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" TEXT NOT NULL,
    "crmCustomerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" "public"."PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "reference" TEXT,
    "attachmentKey" TEXT,
    "verification" "public"."VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "recordedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."portal_accounts" (
    "id" TEXT NOT NULL,
    "crmCustomerId" TEXT NOT NULL,
    "normalizedWhatsapp" TEXT NOT NULL,
    "passwordHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "registeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "portal_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."portal_invites" (
    "id" TEXT NOT NULL,
    "crmCustomerId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "portalAccountId" TEXT,
    "whatsappNumber" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."portfolio_items" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "companyDisplay" TEXT,
    "hideClientName" BOOLEAN NOT NULL DEFAULT false,
    "serviceId" TEXT,
    "styleId" TEXT,
    "formatId" TEXT,
    "durationSec" INTEGER,
    "industry" TEXT,
    "thumbnailKey" TEXT,
    "videoKey" TEXT,
    "successStory" TEXT,
    "status" "public"."PortfolioStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "portfolio_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."project_assignments" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" "public"."AssignmentRole" NOT NULL,
    "userId" TEXT,
    "teamProfileId" TEXT,
    "deadlineAt" TIMESTAMP(3),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."project_context" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contextJson" JSONB NOT NULL,
    "contextMd" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_context_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."project_files" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "public"."FileKind" NOT NULL,
    "name" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "meta" JSONB,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "project_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."project_finance" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "basePrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "agreedPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountReason" TEXT,
    "finalProjectPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "narratorCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "editorCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "otherDirectCosts" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "received" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'AFN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_finance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."project_timeline_events" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "meta" JSONB,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."projects" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "public"."ProjectStatus" NOT NULL DEFAULT 'NEW_MANAGER_REVIEW',
    "customerFacingStatus" "public"."CustomerFacingStatus" NOT NULL DEFAULT 'INFO_RECEIVED',
    "crmCustomerId" TEXT NOT NULL,
    "portalAccountId" TEXT,
    "managerId" TEXT NOT NULL,
    "serviceId" TEXT,
    "styleId" TEXT,
    "formatId" TEXT,
    "orderType" "public"."OrderType",
    "durationSec" INTEGER,
    "language" TEXT,
    "tone" TEXT,
    "platforms" JSONB,
    "brief" JSONB,
    "deadlineAt" TIMESTAMP(3),
    "contentRevisionUsed" INTEGER NOT NULL DEFAULT 0,
    "contentRevisionMax" INTEGER NOT NULL DEFAULT 2,
    "videoRevisionUsed" INTEGER NOT NULL DEFAULT 0,
    "videoRevisionMax" INTEGER NOT NULL DEFAULT 2,
    "extraContentRevision" BOOLEAN NOT NULL DEFAULT false,
    "extraVideoRevision" BOOLEAN NOT NULL DEFAULT false,
    "portfolioPermission" "public"."PortfolioPermission" NOT NULL DEFAULT 'PENDING',
    "holdReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rates" (
    "id" TEXT NOT NULL,
    "teamProfileId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "durationSec" INTEGER,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AFN',
    "serviceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "public"."roles" (
    "id" TEXT NOT NULL,
    "code" "public"."RoleCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "startingPrice" DECIMAL(14,2),
    "durationOptions" JSONB,
    "outputs" JSONB,
    "revisionCount" INTEGER NOT NULL DEFAULT 2,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sessions" (
    "id" TEXT NOT NULL,
    "audience" "public"."SessionAudience" NOT NULL,
    "userId" TEXT,
    "portalAccountId" TEXT,
    "refreshTokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."styles" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailKey" TEXT,
    "previewKey" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "styles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."team_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "public"."TeamKind" NOT NULL,
    "displayName" TEXT NOT NULL,
    "realName" TEXT,
    "languages" JSONB,
    "gender" TEXT,
    "tone" TEXT,
    "specialties" JSONB,
    "status" "public"."AvailabilityStatus" NOT NULL DEFAULT 'ACTIVE',
    "paymentInfo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "team_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_runs_projectId_createdAt_idx" ON "public"."ai_runs"("projectId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "approvals_projectId_idx" ON "public"."approvals"("projectId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "asset_references_projectId_clientAssetId_key" ON "public"."asset_references"("projectId" ASC, "clientAssetId" ASC);

-- CreateIndex
CREATE INDEX "audio_samples_teamProfileId_idx" ON "public"."audio_samples"("teamProfileId" ASC);

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "public"."audit_logs"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "public"."audit_logs"("entityType" ASC, "entityId" ASC);

-- CreateIndex
CREATE INDEX "client_assets_crmCustomerId_idx" ON "public"."client_assets"("crmCustomerId" ASC);

-- CreateIndex
CREATE INDEX "client_feedback_projectId_idx" ON "public"."client_feedback"("projectId" ASC);

-- CreateIndex
CREATE INDEX "content_versions_projectId_idx" ON "public"."content_versions"("projectId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "content_versions_projectId_kind_versionNumber_key" ON "public"."content_versions"("projectId" ASC, "kind" ASC, "versionNumber" ASC);

-- CreateIndex
CREATE INDEX "crm_activities_crmCustomerId_createdAt_idx" ON "public"."crm_activities"("crmCustomerId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "crm_customers_normalizedWhatsapp_key" ON "public"."crm_customers"("normalizedWhatsapp" ASC);

-- CreateIndex
CREATE INDEX "crm_customers_pipelineStage_idx" ON "public"."crm_customers"("pipelineStage" ASC);

-- CreateIndex
CREATE INDEX "crm_customers_portalStatus_idx" ON "public"."crm_customers"("portalStatus" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "download_permissions_projectId_key" ON "public"."download_permissions"("projectId" ASC);

-- CreateIndex
CREATE INDEX "employee_payables_projectId_idx" ON "public"."employee_payables"("projectId" ASC);

-- CreateIndex
CREATE INDEX "employee_payables_teamProfileId_status_idx" ON "public"."employee_payables"("teamProfileId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "expenses_projectId_idx" ON "public"."expenses"("projectId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "formats_ratio_key" ON "public"."formats"("ratio" ASC);

-- CreateIndex
CREATE INDEX "invoices_crmCustomerId_idx" ON "public"."invoices"("crmCustomerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "public"."invoices"("invoiceNumber" ASC);

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "public"."invoices"("status" ASC);

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "public"."notifications"("userId" ASC, "isRead" ASC);

-- CreateIndex
CREATE INDEX "opportunities_crmCustomerId_idx" ON "public"."opportunities"("crmCustomerId" ASC);

-- CreateIndex
CREATE INDEX "opportunities_pipelineStage_idx" ON "public"."opportunities"("pipelineStage" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "opportunities_projectId_key" ON "public"."opportunities"("projectId" ASC);

-- CreateIndex
CREATE INDEX "otp_codes_portalInviteId_idx" ON "public"."otp_codes"("portalInviteId" ASC);

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "public"."payments"("invoiceId" ASC);

-- CreateIndex
CREATE INDEX "payments_verification_idx" ON "public"."payments"("verification" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "public"."permissions"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "portal_accounts_crmCustomerId_key" ON "public"."portal_accounts"("crmCustomerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "portal_accounts_normalizedWhatsapp_key" ON "public"."portal_accounts"("normalizedWhatsapp" ASC);

-- CreateIndex
CREATE INDEX "portal_invites_crmCustomerId_idx" ON "public"."portal_invites"("crmCustomerId" ASC);

-- CreateIndex
CREATE INDEX "portal_invites_token_idx" ON "public"."portal_invites"("token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "portal_invites_token_key" ON "public"."portal_invites"("token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_items_projectId_key" ON "public"."portfolio_items"("projectId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_items_slug_key" ON "public"."portfolio_items"("slug" ASC);

-- CreateIndex
CREATE INDEX "portfolio_items_status_idx" ON "public"."portfolio_items"("status" ASC);

-- CreateIndex
CREATE INDEX "project_assignments_projectId_idx" ON "public"."project_assignments"("projectId" ASC);

-- CreateIndex
CREATE INDEX "project_assignments_teamProfileId_idx" ON "public"."project_assignments"("teamProfileId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "project_context_projectId_key" ON "public"."project_context"("projectId" ASC);

-- CreateIndex
CREATE INDEX "project_files_projectId_kind_idx" ON "public"."project_files"("projectId" ASC, "kind" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "project_finance_projectId_key" ON "public"."project_finance"("projectId" ASC);

-- CreateIndex
CREATE INDEX "project_timeline_events_projectId_createdAt_idx" ON "public"."project_timeline_events"("projectId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "projects_code_key" ON "public"."projects"("code" ASC);

-- CreateIndex
CREATE INDEX "projects_crmCustomerId_idx" ON "public"."projects"("crmCustomerId" ASC);

-- CreateIndex
CREATE INDEX "projects_managerId_idx" ON "public"."projects"("managerId" ASC);

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "public"."projects"("status" ASC);

-- CreateIndex
CREATE INDEX "rates_teamProfileId_idx" ON "public"."rates"("teamProfileId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "public"."roles"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "services_slug_key" ON "public"."services"("slug" ASC);

-- CreateIndex
CREATE INDEX "sessions_portalAccountId_idx" ON "public"."sessions"("portalAccountId" ASC);

-- CreateIndex
CREATE INDEX "sessions_refreshTokenHash_idx" ON "public"."sessions"("refreshTokenHash" ASC);

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "public"."sessions"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "public"."settings"("key" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "styles_slug_key" ON "public"."styles"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "team_profiles_userId_key" ON "public"."team_profiles"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email" ASC);

-- AddForeignKey
ALTER TABLE "public"."ai_runs" ADD CONSTRAINT "ai_runs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_runs" ADD CONSTRAINT "ai_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."approvals" ADD CONSTRAINT "approvals_contentVersionId_fkey" FOREIGN KEY ("contentVersionId") REFERENCES "public"."content_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."approvals" ADD CONSTRAINT "approvals_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."asset_references" ADD CONSTRAINT "asset_references_clientAssetId_fkey" FOREIGN KEY ("clientAssetId") REFERENCES "public"."client_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."asset_references" ADD CONSTRAINT "asset_references_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audio_samples" ADD CONSTRAINT "audio_samples_teamProfileId_fkey" FOREIGN KEY ("teamProfileId") REFERENCES "public"."team_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."client_assets" ADD CONSTRAINT "client_assets_crmCustomerId_fkey" FOREIGN KEY ("crmCustomerId") REFERENCES "public"."crm_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."client_feedback" ADD CONSTRAINT "client_feedback_contentVersionId_fkey" FOREIGN KEY ("contentVersionId") REFERENCES "public"."content_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."client_feedback" ADD CONSTRAINT "client_feedback_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."content_versions" ADD CONSTRAINT "content_versions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."crm_activities" ADD CONSTRAINT "crm_activities_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."crm_activities" ADD CONSTRAINT "crm_activities_crmCustomerId_fkey" FOREIGN KEY ("crmCustomerId") REFERENCES "public"."crm_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."crm_customers" ADD CONSTRAINT "crm_customers_interestedServiceId_fkey" FOREIGN KEY ("interestedServiceId") REFERENCES "public"."services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."crm_customers" ADD CONSTRAINT "crm_customers_salesOwnerId_fkey" FOREIGN KEY ("salesOwnerId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."download_history" ADD CONSTRAINT "download_history_downloadPermissionId_fkey" FOREIGN KEY ("downloadPermissionId") REFERENCES "public"."download_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."download_permissions" ADD CONSTRAINT "download_permissions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employee_payables" ADD CONSTRAINT "employee_payables_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employee_payables" ADD CONSTRAINT "employee_payables_teamProfileId_fkey" FOREIGN KEY ("teamProfileId") REFERENCES "public"."team_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expenses" ADD CONSTRAINT "expenses_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_crmCustomerId_fkey" FOREIGN KEY ("crmCustomerId") REFERENCES "public"."crm_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "public"."opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."opportunities" ADD CONSTRAINT "opportunities_crmCustomerId_fkey" FOREIGN KEY ("crmCustomerId") REFERENCES "public"."crm_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."opportunities" ADD CONSTRAINT "opportunities_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."opportunities" ADD CONSTRAINT "opportunities_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."otp_codes" ADD CONSTRAINT "otp_codes_portalAccountId_fkey" FOREIGN KEY ("portalAccountId") REFERENCES "public"."portal_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."otp_codes" ADD CONSTRAINT "otp_codes_portalInviteId_fkey" FOREIGN KEY ("portalInviteId") REFERENCES "public"."portal_invites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_crmCustomerId_fkey" FOREIGN KEY ("crmCustomerId") REFERENCES "public"."crm_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."portal_accounts" ADD CONSTRAINT "portal_accounts_crmCustomerId_fkey" FOREIGN KEY ("crmCustomerId") REFERENCES "public"."crm_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."portal_invites" ADD CONSTRAINT "portal_invites_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "public"."opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."portal_invites" ADD CONSTRAINT "portal_invites_portalAccountId_fkey" FOREIGN KEY ("portalAccountId") REFERENCES "public"."portal_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."portfolio_items" ADD CONSTRAINT "portfolio_items_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "public"."formats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."portfolio_items" ADD CONSTRAINT "portfolio_items_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."portfolio_items" ADD CONSTRAINT "portfolio_items_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."portfolio_items" ADD CONSTRAINT "portfolio_items_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_assignments" ADD CONSTRAINT "project_assignments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_assignments" ADD CONSTRAINT "project_assignments_teamProfileId_fkey" FOREIGN KEY ("teamProfileId") REFERENCES "public"."team_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_assignments" ADD CONSTRAINT "project_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_context" ADD CONSTRAINT "project_context_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_files" ADD CONSTRAINT "project_files_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_finance" ADD CONSTRAINT "project_finance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_timeline_events" ADD CONSTRAINT "project_timeline_events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."projects" ADD CONSTRAINT "projects_crmCustomerId_fkey" FOREIGN KEY ("crmCustomerId") REFERENCES "public"."crm_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."projects" ADD CONSTRAINT "projects_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "public"."formats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."projects" ADD CONSTRAINT "projects_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."projects" ADD CONSTRAINT "projects_portalAccountId_fkey" FOREIGN KEY ("portalAccountId") REFERENCES "public"."portal_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."projects" ADD CONSTRAINT "projects_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."projects" ADD CONSTRAINT "projects_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "public"."styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rates" ADD CONSTRAINT "rates_teamProfileId_fkey" FOREIGN KEY ("teamProfileId") REFERENCES "public"."team_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "public"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_portalAccountId_fkey" FOREIGN KEY ("portalAccountId") REFERENCES "public"."portal_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."styles" ADD CONSTRAINT "styles_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_profiles" ADD CONSTRAINT "team_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

