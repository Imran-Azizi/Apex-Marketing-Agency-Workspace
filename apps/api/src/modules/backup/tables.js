import { Prisma } from '@prisma/client';

/**
 * Ephemeral / meta tables excluded from full-system backup & restore.
 * SystemBackup is the backup catalog itself — never wipe/replace via restore.
 */
export const SKIP_TABLES = new Set(['Session', 'OtpCode', 'SystemBackup']);

/**
 * Insert order (parents before children). Delete order is reverse.
 * Covers every durable Prisma model so a backup restores the complete system.
 * Keep aligned with schema.prisma FK dependencies.
 */
export const BACKUP_TABLES = [
  // Auth / RBAC
  'Role',
  'Permission',
  'RolePermission',
  'User',
  'UserPermission',
  'Setting',

  // Catalog
  'Service',
  'Style',
  'Format',
  'TeamProfile',
  'Rate',
  'AudioSample',

  // CRM & portal
  'CrmCustomer',
  'WhatsAppInboundEvent',
  'CrmActivity',
  'PortalAccount',
  'ClientAsset',
  'Opportunity',
  'PortalInvite',

  // Projects & production
  'Project',
  'ProjectFinance',
  'ProjectAssignment',
  'ProjectFile',
  'ProjectTimelineEvent',
  'ProjectContext',
  'AssetReference',
  'ContentVersion',
  'NarrationTask',
  'NarrationTake',
  'EditingTask',
  'EditingResource',
  'ProjectPoster',
  'Approval',
  'ClientFeedback',

  // Portfolio / public CMS
  'PortfolioCategory',
  'PortfolioItem',
  'PortfolioItemCategory',
  'MixedPortfolioItem',
  'HeroSlide',
  'ShowcaseCustomer',
  'ContactMessage',
  'CompanyVideo',
  'LandingPage',

  // AI workspace
  'AiAgent',
  'AiWorkflowExecution',
  'AiRun',
  'AiActivityLog',
  'AiSetting',

  // Finance
  'Invoice',
  'InvoiceItem',
  'Payment',
  'Expense',
  'EmployeePayable',
  'EmployeeCompensationProfile',
  'SalaryPayment',
  'SalaryAdvance',
  'FinancePnlTarget',

  // Downloads / notifications / audit
  'DownloadPermission',
  'DownloadHistory',
  'Notification',
  'AuditLog',

  // Internal chat
  'ChatOrgSettings',
  'ChatEmployeeAllowPair',
  'ChatConversation',
  'ChatParticipant',
  'ChatMessage',
  'ChatAttachment',
  'ChatMessageReaction',
  'ChatMessageDelivery',

  // Sales & business assistants
  'SalesAssistantSettings',
  'SalesAssistantRecommendation',
  'SalesAssistantDailyReport',
  'SalesAssistantRun',
  'BusinessAssistantSettings',
  'BusinessAssistantInsight',
  'BusinessAssistantWeeklyReport',
  'BusinessAssistantMonthlyTarget',
  'BusinessAssistantChatMessage',
  'BusinessAssistantRun',
];

/** Models that need a two-pass restore due to self-FKs. */
export const SELF_REF_NULL_ON_CREATE = {
  ChatMessage: ['replyToId'],
};

/**
 * Scalar / JSON fields that hold Bunny (or legacy) object storage keys.
 * Keys embedded in JSON (e.g. LandingPage content) are collected separately.
 */
export const MEDIA_KEY_FIELDS = {
  User: ['profileImage', 'cvStorageKey'],
  ClientAsset: ['storageKey'],
  Service: ['imageKey'],
  Style: ['thumbnailKey', 'previewKey'],
  AudioSample: ['storageKey'],
  ProjectFile: ['storageKey'],
  PortfolioItem: ['storageKey', 'thumbnailKey'],
  EditingResource: ['assetUrl'],
  Payment: ['attachmentKey'],
  Expense: ['receiptKey'],
  HeroSlide: ['imageKey', 'mobileImageKey'],
  ShowcaseCustomer: ['imageKey'],
  ChatAttachment: ['storageKey'],
  CompanyVideo: ['storageKey', 'thumbnailKey'],
};

export function listPrismaModelNames() {
  return Prisma.dmmf.datamodel.models.map((m) => m.name);
}

/** Returns model names present in schema but missing from BACKUP_TABLES (excluding SKIP). */
export function findMissingBackupTables() {
  return listPrismaModelNames().filter(
    (name) => !SKIP_TABLES.has(name) && !BACKUP_TABLES.includes(name),
  );
}

export function assertBackupTablesComplete() {
  const missing = findMissingBackupTables();
  if (missing.length) {
    throw new Error(
      `BACKUP_TABLES incomplete — add models: ${missing.join(', ')}`,
    );
  }
  const unknown = BACKUP_TABLES.filter(
    (name) => !listPrismaModelNames().includes(name),
  );
  if (unknown.length) {
    throw new Error(
      `BACKUP_TABLES references unknown models: ${unknown.join(', ')}`,
    );
  }
}
