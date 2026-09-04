/**
 * Pipeline rules for the Sales Assistant Agent.
 */

import { stageLabel } from '../crm/pipeline.js';
import { KINDS } from './constants.js';

const OBJECTION_PATTERNS = [
  { key: 'price', re: /قیمت|گران|هزینه|بودجه|تخفیف|ارزان/i },
  { key: 'time', re: /زمان|عجله|بعدا|بعداً|هفته|ماه/i },
  { key: 'trust', re: /مطمئن|اعتماد|نمونه|کیفیت|تجربه/i },
  { key: 'decision_maker', re: /همکار|مدیر|شریک|همسر|خانواده|تصمیم/i },
];

const INTENT_PATTERNS = [
  { level: 'high', re: /آماده|تأیید|تایید|قرارداد|شروع|بیعانه|پرداخت|سفارش/i },
  { level: 'medium', re: /قیمت|پکیج|جزئیات|نمونه|پیشنهاد|بررسی/i },
  { level: 'low', re: /بعدا|بعداً|فعلا|فعلاً|شاید|فکر/i },
];

const MEANINGFUL_TYPES = new Set([
  'INTERACTION',
  'WHATSAPP_MESSAGE',
  'CONTACT_FORM',
  'INFORMATION_SENT',
  'PROPOSAL_SENT',
  'PRICE_SENT',
  'WAITING_DECISION',
  'NOTE',
  'STATUS_CHANGED',
]);

export function hoursSince(date, now = new Date()) {
  if (!date) return Infinity;
  const t = date instanceof Date ? date.getTime() : new Date(date).getTime();
  if (!Number.isFinite(t)) return Infinity;
  return Math.max(0, (now.getTime() - t) / 3_600_000);
}

export function deriveStageEnteredAt(customer, activities = []) {
  const stage = customer?.pipelineStage;
  const hit = (activities || []).find(
    (a) => a.type === 'STATUS_CHANGED' && a.newStatus === stage,
  );
  if (hit?.createdAt) return new Date(hit.createdAt);
  return customer?.updatedAt || customer?.createdAt || new Date();
}

export function isCustomerActivity(activity) {
  if (!activity) return false;
  if (activity.actorType === 'CUSTOMER') return true;
  const type = String(activity.type || '');
  return type === 'WHATSAPP_MESSAGE' || type === 'CONTACT_FORM';
}

export function isSalesActivity(activity) {
  if (!activity) return false;
  if (activity.actorType === 'USER') return true;
  const type = String(activity.type || '');
  return ['INTERACTION', 'INFORMATION_SENT', 'PROPOSAL_SENT', 'PRICE_SENT'].includes(type);
}

export function isMeaningfulProgress(activity) {
  if (!activity) return false;
  return MEANINGFUL_TYPES.has(String(activity.type || ''));
}

function clipText(value, max = 400) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function conversationBlob(activities = []) {
  return (activities || [])
    .slice(0, 12)
    .map((a) => clipText(a.body || a.title, 200))
    .filter(Boolean)
    .join('\n');
}

export function detectObjections(text) {
  const hay = String(text || '');
  return OBJECTION_PATTERNS.filter((p) => p.re.test(hay)).map((p) => p.key);
}

export function detectIntentLevel(text) {
  const hay = String(text || '');
  for (const p of INTENT_PATTERNS) {
    if (p.re.test(hay)) return { level: p.level, hits: [p.level] };
  }
  return { level: 'unknown', hits: [] };
}

export function isActivelyProgressing(context, settings = {}) {
  const windowH = Math.max(1, Number(settings.skipIfActiveHours) || 18);
  const recentCustomer = hoursSince(context.lastCustomerMessage?.createdAt) <= windowH;
  const recentSales = hoursSince(context.lastSalesMessage?.createdAt) <= windowH;
  return recentCustomer && recentSales;
}

function formatDays(days) {
  const n = Math.round(Number(days) * 10) / 10;
  return `${n} روز`;
}

/**
 * Evaluate a hydrated customer snapshot and return zero or more signals.
 */
export function evaluateSignals(context, settings = {}) {
  const stage = String(context.pipelineStage || '');
  const signals = [];
  if (!context.customerId) return signals;
  if (stage === 'LOST_CANCELED') return signals;

  const waitingDays = Math.max(0, Number(settings.decisionWaitingDays) || 2);
  const depositDays = Math.max(0, Number(settings.pendingDepositDays) || 1);
  const repeatMin = Math.max(1, Number(settings.repeatOrderMinDays) || 45);
  const repeatMax = Math.max(repeatMin, Number(settings.repeatOrderMaxDays) || 180);
  const daysInStage = Number(context.daysInStage) || 0;
  const blob = conversationBlob(context.activities);
  const lastCustomerText = clipText(
    context.lastCustomerMessage?.body || context.lastCustomerMessage?.title,
    400,
  );
  const combinedText = `${blob}\n${lastCustomerText}\n${context.notes || ''}`;
  const objections = detectObjections(combinedText);
  const intent = detectIntentLevel(combinedText);
  const progressing = isActivelyProgressing(context, settings);

  const base = {
    facts: [...(context.facts || [])],
    interpretations: [],
    objections,
    intentLevel: intent.level,
    intentHits: intent.hits,
    lastCustomerText,
    lastSalesText: clipText(
      context.lastSalesMessage?.body || context.lastSalesMessage?.title,
      400,
    ),
    trigger: stage,
  };

  // 1. Decision waiting follow-up (2+ days)
  if (stage === 'WAITING_DECISION' && daysInStage >= waitingDays && !progressing) {
    const recentProgress = (context.activitiesAfterStage || []).some(
      (a) => isMeaningfulProgress(a) && a.type !== 'STATUS_CHANGED',
    );
    if (!recentProgress) {
      signals.push({
        kind: KINDS.FOLLOW_UP,
        ...base,
        facts: [
          ...base.facts,
          `وضعیت فعلی: ${stageLabel(stage)}`,
          `مدت ماندن در این مرحله: حدود ${formatDays(daysInStage)}`,
        ],
        trigger: 'WAITING_DECISION',
      });
    }
  }

  // 2. Pending deposit follow-up (1+ day, no verified deposit)
  if (
    stage === 'DEPOSIT_PENDING'
    && daysInStage >= depositDays
    && !context.hasVerifiedDeposit
    && !progressing
  ) {
    signals.push({
      kind: KINDS.DEPOSIT_FOLLOW_UP,
      ...base,
      facts: [
        ...base.facts,
        `وضعیت فعلی: ${stageLabel(stage)}`,
        `مدت ماندن در این مرحله: حدود ${formatDays(daysInStage)}`,
        'پرداخت تأییدشده ثبت نشده',
      ],
      trigger: 'DEPOSIT_PENDING',
    });
  }

  // 3. Repeat order window
  const daysSinceDelivered = context.orders?.daysSinceLastDelivered;
  const deliveredCount = Number(context.orders?.deliveredCount) || 0;
  const hasOpenCycle = context.orders?.hasOpenSalesCycle;
  if (
    deliveredCount > 0
    && daysSinceDelivered != null
    && daysSinceDelivered >= repeatMin
    && daysSinceDelivered <= repeatMax
    && !hasOpenCycle
    && !['LOST_CANCELED', 'DEPOSIT_PENDING', 'WAITING_DECISION'].includes(stage)
  ) {
    signals.push({
      kind: KINDS.REPEAT_ORDER,
      ...base,
      facts: [
        ...base.facts,
        `آخرین تحویل: حدود ${formatDays(daysSinceDelivered)} پیش`,
        `تعداد تحویل‌های قبلی: ${deliveredCount}`,
      ],
      trigger: 'REPEAT_ORDER',
    });
  }

  return signals;
}
