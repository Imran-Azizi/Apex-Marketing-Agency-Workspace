/**
 * Canonical CRM pipeline — stages, categories, transition rules.
 * Labels live here (not in business conditionals) so UI/API can localize.
 */

import { financialPaymentWhere } from './sampleInvoice.js';

export const CRM_STAGES = Object.freeze([
  'NEW_LEAD',
  'CONTACTED',
  'INFORMATION_SENT',
  'PROPOSAL_PRICE_SENT',
  'WAITING_DECISION',
  'ORDER_CONFIRMED',
  'DEPOSIT_PENDING',
  'DEPOSIT_CONFIRMED',
  'PORTAL_INVITED',
  'PROJECT_CREATED',
  'DELIVERED',
  'REPEAT_CUSTOMER',
  'LOST_CANCELED',
]);

/** Legacy enum values still referenced in older code paths. */
export const STAGE_ALIASES = Object.freeze({
  INTERESTED: 'INFORMATION_SENT',
  PRICE_SENT: 'PROPOSAL_PRICE_SENT',
  COMPLETED: 'DELIVERED',
  CANCELED: 'LOST_CANCELED',
});

export const STAGE_LABELS = Object.freeze({
  NEW_LEAD: 'سرنخ جدید',
  CONTACTED: 'تماس گرفته‌شده',
  INFORMATION_SENT: 'اطلاعات ارسال‌شده',
  PROPOSAL_PRICE_SENT: 'پیشنهاد / قیمت ارسال‌شده',
  WAITING_DECISION: 'در انتظار تصمیم',
  ORDER_CONFIRMED: 'سفارش تأییدشده',
  DEPOSIT_PENDING: 'در انتظار بیعانه',
  DEPOSIT_CONFIRMED: 'بیعانه تأییدشده',
  PORTAL_INVITED: 'دعوت پورتال',
  PROJECT_CREATED: 'پروژه ایجادشده',
  DELIVERED: 'تحویل‌شده',
  REPEAT_CUSTOMER: 'مشتری تکراری',
  LOST_CANCELED: 'از‌دست‌رفته / لغوشده',
});

export const CRM_CATEGORIES = Object.freeze([
  'GHOST',
  'INTERESTED',
  'FOLLOW_UP',
  'OUR_CUSTOMERS',
]);

export const CATEGORY_LABELS = Object.freeze({
  GHOST: 'سرنخ‌های روح',
  INTERESTED: 'سرنخ‌های علاقمند',
  FOLLOW_UP: 'سرنخ‌های قابل پیگیری',
  OUR_CUSTOMERS: 'مشتریان ما',
});

export const CATEGORY_DESCRIPTIONS = Object.freeze({
  GHOST: 'سرنخ‌هایی که در مراحل سرنخ جدید، تماس، یا اطلاعات ارسال‌شده هستند',
  INTERESTED: 'سرنخ‌هایی که پیشنهاد / قیمت ارسال‌شده دریافت کرده‌اند',
  FOLLOW_UP: 'سرنخ‌های در انتظار تصمیم، سفارش، پرداخت، یا فعالیت عملیاتی',
  OUR_CUSTOMERS: 'کسانی که پرداخت تأییدشده دارند و مشتری شده‌اند',
});

export const ACTIVITY_TYPES = Object.freeze({
  LEAD_CREATED: 'LEAD_CREATED',
  WHATSAPP_MESSAGE: 'WHATSAPP_MESSAGE',
  CONTACT_FORM: 'CONTACT_FORM',
  INTERACTION: 'INTERACTION',
  NOTE: 'NOTE',
  STATUS_CHANGED: 'STATUS_CHANGED',
  ASSIGNED: 'ASSIGNED',
  PHONE_CHANGED: 'PHONE_CHANGED',
  CUSTOMER_INFO_SAVED: 'CUSTOMER_INFO_SAVED',
  CUSTOMER_CREATED: 'CUSTOMER_CREATED',
  INVOICE_CREATED: 'INVOICE_CREATED',
  PAYMENT_SUBMITTED: 'PAYMENT_SUBMITTED',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  PAYMENT_REJECTED: 'PAYMENT_REJECTED',
  PAYMENT_REVERSED: 'PAYMENT_REVERSED',
  PORTAL_INVITATION_SENT: 'PORTAL_INVITATION_SENT',
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_DELIVERED: 'PROJECT_DELIVERED',
  LEAD_LOST: 'LEAD_LOST',
});

export const ACTIVITY_LABELS = Object.freeze({
  LEAD_CREATED: 'سرنخ ایجاد شد',
  WHATSAPP_MESSAGE: 'پیام واتساپ دریافت شد',
  CONTACT_FORM: 'فرم تماس وب‌سایت',
  INTERACTION: 'تعامل ثبت شد',
  NOTE: 'یادداشت افزوده شد',
  STATUS_CHANGED: 'وضعیت تغییر کرد',
  ASSIGNED: 'مسئول فروش تعیین شد',
  PHONE_CHANGED: 'شماره تماس به‌روزرسانی شد',
  CUSTOMER_INFO_SAVED: 'اطلاعات مشتری ذخیره شد',
  CUSTOMER_CREATED: 'مشتری ایجاد شد',
  INVOICE_CREATED: 'فاکتور ایجاد شد',
  PAYMENT_SUBMITTED: 'پرداخت ثبت شد',
  PAYMENT_CONFIRMED: 'پرداخت تأیید شد',
  PAYMENT_REJECTED: 'پرداخت رد شد',
  PAYMENT_REVERSED: 'پرداخت برگشت داده شد',
  PORTAL_INVITATION_SENT: 'دعوت پورتال ارسال شد',
  PROJECT_CREATED: 'پروژه ایجاد شد',
  PROJECT_DELIVERED: 'پروژه تحویل شد',
  LEAD_LOST: 'سرنخ از‌دست‌رفته / لغو شد',
});

export const CRM_EVENTS = Object.freeze({
  LEAD_CREATED: 'LEAD_CREATED',
  INTERACTION: 'INTERACTION',
  INFORMATION_SENT: 'INFORMATION_SENT',
  PROPOSAL_SENT: 'PROPOSAL_SENT',
  WAITING_DECISION: 'WAITING_DECISION',
  ORDER_CONFIRMED: 'ORDER_CONFIRMED',
  INVOICE_CREATED: 'INVOICE_CREATED',
  PAYMENT_SUBMITTED: 'PAYMENT_SUBMITTED',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  PAYMENT_REJECTED: 'PAYMENT_REJECTED',
  PAYMENT_REVERSED: 'PAYMENT_REVERSED',
  CUSTOMER_CONVERTED: 'CUSTOMER_CONVERTED',
  PORTAL_INVITED: 'PORTAL_INVITED',
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_DELIVERED: 'PROJECT_DELIVERED',
  REPEAT_ORDER: 'REPEAT_ORDER',
  LOST: 'LOST',
  MANUAL_STAGE: 'MANUAL_STAGE',
});

const STAGE_RANK = Object.freeze({
  NEW_LEAD: 0,
  CONTACTED: 1,
  INFORMATION_SENT: 2,
  PROPOSAL_PRICE_SENT: 3,
  WAITING_DECISION: 4,
  ORDER_CONFIRMED: 5,
  DEPOSIT_PENDING: 6,
  DEPOSIT_CONFIRMED: 7,
  PORTAL_INVITED: 8,
  PROJECT_CREATED: 9,
  DELIVERED: 10,
  REPEAT_CUSTOMER: 11,
  LOST_CANCELED: -1,
});

const GHOST_CATEGORY_STAGES = Object.freeze([
  'NEW_LEAD',
  'CONTACTED',
  'INFORMATION_SENT',
]);

const INTERESTED_CATEGORY_STAGES = Object.freeze([
  'PROPOSAL_PRICE_SENT',
]);

/** Lead stages counted in سرنخ‌های قابل پیگیری (includes full early funnel). */
const FOLLOW_UP_LEAD_STAGES = Object.freeze([
  'NEW_LEAD',
  'CONTACTED',
  'INFORMATION_SENT',
  'PROPOSAL_PRICE_SENT',
  'WAITING_DECISION',
]);

const FOLLOW_UP_COMMERCIAL_STAGES = Object.freeze([
  'ORDER_CONFIRMED',
  'DEPOSIT_PENDING',
  'DEPOSIT_CONFIRMED',
]);

const FOLLOW_UP_EXTENDED_STAGES = Object.freeze([
  'PORTAL_INVITED',
  'PROJECT_CREATED',
  'DELIVERED',
  'REPEAT_CUSTOMER',
]);

const FOLLOW_UP_CATEGORY_STAGES = Object.freeze([
  'WAITING_DECISION',
  ...FOLLOW_UP_COMMERCIAL_STAGES,
  ...FOLLOW_UP_EXTENDED_STAGES,
]);

const GHOST_STAGE_SET = new Set(GHOST_CATEGORY_STAGES);
const INTERESTED_STAGE_SET = new Set(INTERESTED_CATEGORY_STAGES);
const FOLLOW_UP_LEAD_STAGE_SET = new Set(FOLLOW_UP_LEAD_STAGES);
const FOLLOW_UP_COMMERCIAL_STAGE_SET = new Set(FOLLOW_UP_COMMERCIAL_STAGES);
const FOLLOW_UP_STAGE_SET = new Set(FOLLOW_UP_CATEGORY_STAGES);
const FOLLOW_UP_EXTENDED_STAGE_SET = new Set(FOLLOW_UP_EXTENDED_STAGES);
const CLOSED_STAGES = new Set(['LOST_CANCELED']);
const TRANSFER_BLOCKED_STAGES = new Set(['DELIVERED', 'LOST_CANCELED']);
/** Completed projects leave the active management list but stay in CRM history. */
export const MANAGEMENT_INACTIVE_STAGES = Object.freeze(['DELIVERED']);
const MANAGEMENT_INACTIVE_STAGE_SET = new Set(MANAGEMENT_INACTIVE_STAGES);
/**
 * Sales / decision stages — users change these manually from CRM و فروش.
 * Operational progress after deposit confirmation is system-driven.
 */
export const SALES_MANUAL_STAGES = Object.freeze([
  'NEW_LEAD',
  'CONTACTED',
  'INFORMATION_SENT',
  'PROPOSAL_PRICE_SENT',
  'WAITING_DECISION',
  'ORDER_CONFIRMED',
  'DEPOSIT_PENDING',
  'LOST_CANCELED',
  'REPEAT_CUSTOMER',
]);

const SALES_MANUAL_STAGE_SET = new Set(SALES_MANUAL_STAGES);

/** Stages advanced only by system events (payment, portal, project, delivery). */
export const AUTOMATIC_STAGES = Object.freeze([
  'DEPOSIT_CONFIRMED',
  'PORTAL_INVITED',
  'PROJECT_CREATED',
  'DELIVERED',
]);

const AUTOMATIC_STAGE_SET = new Set(AUTOMATIC_STAGES);

export function isAutomaticStage(stage) {
  return AUTOMATIC_STAGE_SET.has(canonicalizeStage(stage));
}

export function isManualStage(stage) {
  return SALES_MANUAL_STAGE_SET.has(canonicalizeStage(stage));
}

export function stageControl(stage) {
  const code = canonicalizeStage(stage);
  if (code === 'LOST_CANCELED') return 'canceled';
  if (code === 'DELIVERED') return 'completed';
  if (code === 'REPEAT_CUSTOMER') return 'repeat';
  if (AUTOMATIC_STAGE_SET.has(code)) return 'automatic';
  return 'manual';
}

const INTERACTION_STAGE = Object.freeze({
  CONTACT: 'CONTACTED',
  CALL: 'CONTACTED',
  MESSAGE: 'CONTACTED',
  WHATSAPP: 'CONTACTED',
  INFORMATION_SENT: 'INFORMATION_SENT',
  PROPOSAL_SENT: 'PROPOSAL_PRICE_SENT',
  PRICE_SENT: 'PROPOSAL_PRICE_SENT',
  WAITING_DECISION: 'WAITING_DECISION',
  NOTE: null,
});

/** @deprecated Kept for interaction type labels in UI; sales stages are no longer auto-advanced. */
export function interactionSuggestedStage(interactionType) {
  return INTERACTION_STAGE[String(interactionType || 'CONTACT').toUpperCase()] || 'CONTACTED';
}

export function canonicalizeStage(stage) {
  if (!stage) return 'NEW_LEAD';
  const raw = String(stage).toUpperCase();
  const mapped = STAGE_ALIASES[raw] || raw;
  return CRM_STAGES.includes(mapped) ? mapped : 'NEW_LEAD';
}

export function stageRank(stage) {
  const key = canonicalizeStage(stage);
  return STAGE_RANK[key] ?? 0;
}

export function stageLabel(stage) {
  return STAGE_LABELS[canonicalizeStage(stage)] || String(stage || '—');
}

export function categoryLabel(category) {
  return CATEGORY_LABELS[category] || null;
}

export function activityLabel(type) {
  return ACTIVITY_LABELS[type] || String(type || '—');
}

export function isClosedStage(stage) {
  return CLOSED_STAGES.has(canonicalizeStage(stage));
}

export function canTransferToManagement(customer) {
  if (Boolean(customer?.convertedAt)) return false;
  return !TRANSFER_BLOCKED_STAGES.has(canonicalizeStage(customer?.pipelineStage));
}

/**
 * Active on مدیریت مشتریان: transferred (convertedAt) and not delivered.
 * Kept separate from OUR_CUSTOMERS category (verified-payment badge).
 */
export function isActiveInManagement(customer) {
  if (!customer?.convertedAt) return false;
  return !MANAGEMENT_INACTIVE_STAGE_SET.has(canonicalizeStage(customer.pipelineStage));
}

export function isManagerRole(roleCode) {
  return roleCode === 'MANAGER' || roleCode === 'ADMIN';
}

/**
 * Commercial / post-order activity → follow-up (exclusive, not our-customers yet).
 */
export function customerQualifiesForFollowUp(customer) {
  const stage = canonicalizeStage(customer?.pipelineStage);
  if (stage === 'LOST_CANCELED') return false;
  if (FOLLOW_UP_COMMERCIAL_STAGE_SET.has(stage)) return true;
  if (FOLLOW_UP_EXTENDED_STAGE_SET.has(stage)) return true;
  if (customer?.hasProject) return true;
  if (customer?.hasPayment) return true;
  return false;
}

/** Maps pipeline stage to exactly one lead category (mutually exclusive). */
export function categoryForStage(stage) {
  const s = canonicalizeStage(stage);
  if (s === 'LOST_CANCELED') return null;
  if (GHOST_STAGE_SET.has(s)) return 'GHOST';
  if (INTERESTED_STAGE_SET.has(s)) return 'INTERESTED';
  if (s === 'WAITING_DECISION') return 'FOLLOW_UP';
  if (FOLLOW_UP_COMMERCIAL_STAGE_SET.has(s) || FOLLOW_UP_EXTENDED_STAGE_SET.has(s)) {
    return 'FOLLOW_UP';
  }
  return null;
}

/**
 * Exactly one category per customer — used for badges, stat cards, and filters.
 */
export function deriveCategory(customer) {
  const stage = canonicalizeStage(customer?.pipelineStage);
  if (stage === 'LOST_CANCELED') return null;
  if (customer?.hasVerifiedPayment) return 'OUR_CUSTOMERS';
  if (customerQualifiesForFollowUp(customer)) return 'FOLLOW_UP';
  return categoryForStage(stage);
}

/** Pipeline stages for category list filters (matches deriveCategory). */
export function stagesForCategory(category) {
  const code = String(category || '').toUpperCase();
  if (code === 'GHOST') return [...GHOST_CATEGORY_STAGES];
  if (code === 'INTERESTED') return [...INTERESTED_CATEGORY_STAGES];
  if (code === 'FOLLOW_UP') return [...FOLLOW_UP_CATEGORY_STAGES];
  if (code === 'OUR_CUSTOMERS') {
    return CRM_STAGES.filter((s) => stageRank(s) >= stageRank('ORDER_CONFIRMED') && s !== 'LOST_CANCELED');
  }
  return [];
}

function notOurCustomerClause() {
  return {
    payments: {
      none: { verification: 'VERIFIED', ...financialPaymentWhere() },
    },
  };
}

/**
 * Prisma where fragment — mutually exclusive with other categories (stats + row badges).
 */
export function buildCategoryWhere(category, { excludeLost = true } = {}) {
  const code = String(category || '').toUpperCase();
  const notLost = excludeLost ? [{ pipelineStage: { not: 'LOST_CANCELED' } }] : [];

  if (code === 'OUR_CUSTOMERS') {
    return {
      AND: [
        ...notLost,
        { payments: { some: { verification: 'VERIFIED', ...financialPaymentWhere() } } },
      ],
    };
  }

  if (code === 'GHOST') {
    return {
      AND: [
        ...notLost,
        notOurCustomerClause(),
        { pipelineStage: { in: [...GHOST_CATEGORY_STAGES] } },
      ],
    };
  }

  if (code === 'INTERESTED') {
    return {
      AND: [
        ...notLost,
        notOurCustomerClause(),
        { pipelineStage: { in: [...INTERESTED_CATEGORY_STAGES] } },
      ],
    };
  }

  if (code === 'FOLLOW_UP') {
    return {
      AND: [
        ...notLost,
        notOurCustomerClause(),
        {
          OR: [
            { pipelineStage: 'WAITING_DECISION' },
            { pipelineStage: { in: [...FOLLOW_UP_COMMERCIAL_STAGES] } },
            { pipelineStage: { in: [...FOLLOW_UP_EXTENDED_STAGES] } },
            {
              AND: [
                {
                  pipelineStage: {
                    notIn: [
                      ...GHOST_CATEGORY_STAGES,
                      ...INTERESTED_CATEGORY_STAGES,
                      'WAITING_DECISION',
                      ...FOLLOW_UP_COMMERCIAL_STAGES,
                      ...FOLLOW_UP_EXTENDED_STAGES,
                    ],
                  },
                },
                { projects: { some: { deletedAt: null } } },
              ],
            },
            {
              AND: [
                {
                  pipelineStage: {
                    notIn: [
                      ...GHOST_CATEGORY_STAGES,
                      ...INTERESTED_CATEGORY_STAGES,
                      'WAITING_DECISION',
                      ...FOLLOW_UP_COMMERCIAL_STAGES,
                      ...FOLLOW_UP_EXTENDED_STAGES,
                    ],
                  },
                },
                { payments: { some: financialPaymentWhere() } },
              ],
            },
          ],
        },
      ],
    };
  }

  return null;
}

/** Exclusive category totals from a stage histogram (one category per stage bucket). */
export function countCategoryFromStageTotals(byStage = {}) {
  const categories = Object.fromEntries(CRM_CATEGORIES.map((c) => [c, 0]));
  for (const [stage, count] of Object.entries(byStage)) {
    const n = Number(count) || 0;
    if (!n) continue;
    const cat = categoryForStage(stage);
    if (cat && Object.prototype.hasOwnProperty.call(categories, cat)) {
      categories[cat] += n;
    }
  }
  return categories;
}

/** @deprecated Use countCategoryFromStageTotals or buildCategoryWhere. */
export function tallyCategories(byStage = {}) {
  return countCategoryFromStageTotals(byStage);
}

export function eventTargetStage(event, currentStage, extras = {}) {
  const current = canonicalizeStage(currentStage);
  switch (event) {
    case CRM_EVENTS.LEAD_CREATED:
      return 'NEW_LEAD';
    // Sales stages are manual — interaction/invoice events log history only.
    case CRM_EVENTS.INTERACTION:
    case CRM_EVENTS.INFORMATION_SENT:
    case CRM_EVENTS.PROPOSAL_SENT:
    case CRM_EVENTS.WAITING_DECISION:
    case CRM_EVENTS.ORDER_CONFIRMED:
    case CRM_EVENTS.INVOICE_CREATED:
    case CRM_EVENTS.PAYMENT_SUBMITTED:
      return null;
    case CRM_EVENTS.PAYMENT_CONFIRMED:
      return 'DEPOSIT_CONFIRMED';
    case CRM_EVENTS.PAYMENT_REVERSED:
      // Operational rollback only — never invent a sales status jump.
      if (extras.hasVerifiedPayment) return current;
      if (current === 'DEPOSIT_CONFIRMED' || stageRank(current) > stageRank('DEPOSIT_PENDING')) {
        return 'DEPOSIT_PENDING';
      }
      return current;
    case CRM_EVENTS.PORTAL_INVITED:
      return 'PORTAL_INVITED';
    case CRM_EVENTS.PROJECT_CREATED:
      return 'PROJECT_CREATED';
    case CRM_EVENTS.PROJECT_DELIVERED:
      return 'DELIVERED';
    // Repeat Customer is activated manually; portal orders only log activity.
    case CRM_EVENTS.REPEAT_ORDER:
      return null;
    case CRM_EVENTS.LOST:
      return 'LOST_CANCELED';
    case CRM_EVENTS.MANUAL_STAGE:
      return canonicalizeStage(extras.targetStage);
    default:
      return null;
  }
}

/**
 * Automatic events only move forward. Lost/repeat/manual-force can jump.
 */
export function shouldApplyStage({ currentStage, nextStage, force = false, event }) {
  const current = canonicalizeStage(currentStage);
  const next = canonicalizeStage(nextStage);
  if (!next || current === next) return false;
  if (force) return true;
  if (next === 'LOST_CANCELED') return current !== 'LOST_CANCELED';
  if (current === 'LOST_CANCELED') return false;
  if (next === 'REPEAT_CUSTOMER') return true;
  if (event === CRM_EVENTS.PAYMENT_REVERSED) {
    return stageRank(next) < stageRank(current) || next !== current;
  }
  return stageRank(next) > stageRank(current);
}

/**
 * CRM users with edit permission may set any configured pipeline stage manually.
 */
export function canManuallySetStage(auth, targetStage, _currentStage = null) {
  const next = canonicalizeStage(targetStage);
  if (!CRM_STAGES.includes(next)) return false;
  const perms = new Set(auth?.permissions || []);
  return isManagerRole(auth?.roleCode) || perms.has('crm.edit');
}

/** All configured stages for CRM status UI. */
export function manualStageOptions(_currentStage, _auth = {}) {
  return [...CRM_STAGES];
}

export function getAllowedActions(customer, auth = {}, extras = {}) {
  const stage = canonicalizeStage(customer?.pipelineStage);
  const converted = Boolean(customer?.convertedAt);
  const closed = isClosedStage(stage);
  const manager = isManagerRole(auth?.roleCode);
  const perms = new Set(auth?.permissions || []);
  const canEdit = manager || perms.has('crm.edit');
  const canCreate = manager || perms.has('crm.create');
  const canDelete = manager || perms.has('crm.delete');
  const canInvite = manager || perms.has('crm.invite');
  const canFinance = manager || perms.has('finance.create') || perms.has('crm.opportunity');
  const canViewFinance = manager || perms.has('finance.view') || perms.has('crm.view');
  const rank = stageRank(stage);
  const hasProject = extras.hasProject === true || (customer?.projects?.length > 0);
  const hasInvoice = extras.hasInvoice === true || (customer?.invoices?.length > 0);
  const hasPayment = extras.hasPayment === true || (customer?.payments?.length > 0);
  const canChangeStatus = canEdit;

  return {
    view: true,
    edit: canEdit && !closed,
    delete: canDelete,
    recordCustomerInfo: canEdit && !closed,
    addNote: canEdit,
    addInteraction: canEdit && !closed,
    changeStatus: canChangeStatus,
    createInvoice: canFinance && !closed,
    createCustomer: canCreate && !converted && !closed,
    transferToManagement: canCreate && canTransferToManagement(customer),
    viewCustomer: converted,
    viewProject: hasProject,
    viewPayment: canViewFinance && hasPayment,
    viewInvoice: hasInvoice,
    invitePortal: canInvite && !closed && (converted || rank >= stageRank('DEPOSIT_CONFIRMED')),
    markRepeatCustomer: canEdit,
    createNewProject: !closed && (stage === 'REPEAT_CUSTOMER' || stage === 'PORTAL_INVITED' || stage === 'PROJECT_CREATED'),
    assign: manager || canEdit,
  };
}

export function pipelineCatalog() {
  return {
    stages: CRM_STAGES.map((code) => ({
      code,
      label: STAGE_LABELS[code],
      rank: STAGE_RANK[code],
      control: stageControl(code),
      automatic: isAutomaticStage(code),
    })),
    categories: CRM_CATEGORIES.map((code) => ({
      code,
      label: CATEGORY_LABELS[code],
      description: CATEGORY_DESCRIPTIONS[code],
    })),
    activityTypes: Object.keys(ACTIVITY_LABELS).map((code) => ({
      code,
      label: ACTIVITY_LABELS[code],
    })),
    manualStages: [...SALES_MANUAL_STAGES],
    automaticStages: [...AUTOMATIC_STAGES],
  };
}
