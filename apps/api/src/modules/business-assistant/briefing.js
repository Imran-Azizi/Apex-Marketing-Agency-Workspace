/**
 * Deterministic business briefing from live snapshot + analysis signals.
 * AI may enrich narrative; KPI numbers always come from the system.
 */

import { composeInsight } from './compose.js';
import { CATEGORY_LABELS, KIND_LABELS, PRIORITY_LABELS, SWOT } from './constants.js';

const PRIORITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 };

function formatAfn(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('en-US')} AFN`;
}

function timeframeForPriority(priority) {
  if (priority === 'HIGH') return 'این هفته';
  if (priority === 'MEDIUM') return 'دو هفته آینده';
  return 'این ماه';
}

function findingFromSignal(signal) {
  const copy = composeInsight(signal);
  return {
    title: copy.title,
    what: copy.recommendedAction,
    why: copy.reason,
    problemOrOpportunity: `${KIND_LABELS[signal.kind] || signal.kind} — ${CATEGORY_LABELS[signal.category] || signal.category}`,
    impact: copy.actionPlan || copy.recommendedAction,
    priority: signal.priority || 'MEDIUM',
    priorityLabel: PRIORITY_LABELS[signal.priority] || signal.priority,
    timeframe: timeframeForPriority(signal.priority),
    category: signal.category,
    swot: signal.strengthOrWeakness,
  };
}

function sortByPriority(items) {
  return [...items].sort(
    (a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9),
  );
}

export function composeBriefing(snapshot, signals = []) {
  const finance = snapshot?.finance || {};
  const month = finance.month || {};
  const prev = finance.previousMonth || {};
  const trends = finance.trends || {};
  const crm = snapshot?.crm || {};
  const projects = snapshot?.projects || {};
  const sales = snapshot?.sales || {};
  const marketing = snapshot?.marketing || {};
  const hr = snapshot?.hr || {};

  const received = Number(month.received || 0);
  const netProfit = Number(month.netCompanyProfit || 0);
  const receivable = Number(finance.allTime?.receivable || 0);
  const newCustomers = Number(sales.newCustomersThisMonth || 0);
  const activeProjects = Number(projects.active || 0);
  const pipelineTotal = (crm.pipeline || []).reduce((s, p) => s + Number(p.count || 0), 0);

  const insufficientData =
    received <= 0 &&
    newCustomers <= 0 &&
    activeProjects <= 0 &&
    pipelineTotal <= 0 &&
    Number(marketing.contactMessagesThisMonth || 0) <= 0;

  const findings = sortByPriority(signals.map(findingFromSignal));
  const goingWell = findings.filter(
    (f) => f.swot === SWOT.STRENGTH || (f.swot === SWOT.OPPORTUNITY && f.priority === 'LOW'),
  );
  const needsAttention = findings.filter(
    (f) => f.swot === SWOT.WEAKNESS || f.swot === SWOT.RISK,
  );
  const strengths = findings.filter((f) => f.swot === SWOT.STRENGTH);
  const weaknesses = findings.filter((f) => f.swot === SWOT.WEAKNESS);
  const opportunities = findings.filter((f) => f.swot === SWOT.OPPORTUNITY);
  const recommendedActions = sortByPriority(
    findings.filter((f) => f.swot !== SWOT.STRENGTH || f.priority === 'HIGH'),
  ).slice(0, 8);

  const overviewParts = [];
  overviewParts.push(
    `دریافتی ماه جاری ${formatAfn(received)} (${trends.revenuePct >= 0 ? '+' : ''}${trends.revenuePct ?? 0}% نسبت به ماه قبل).`,
  );
  overviewParts.push(
    `سود خالص ${formatAfn(netProfit)} · مطالبات ${formatAfn(receivable)}.`,
  );
  overviewParts.push(
    `مشتریان جدید این ماه: ${newCustomers} · پروژه‌های فعال: ${activeProjects} · تأخیری: ${projects.overdue || 0}.`,
  );
  if (crm.stuckInPipeline) {
    overviewParts.push(`${crm.stuckInPipeline} مشتری در مسیر فروش متوقف شده است.`);
  }
  if (insufficientData) {
    overviewParts.push(
      'داده کافی برای تحلیل کامل وجود ندارد. پس از ثبت فروش، پروژه و مشتری، توصیه‌ها دقیق‌تر می‌شوند.',
    );
  }

  const weeklyTasks = sortByPriority(needsAttention.concat(opportunities)).slice(0, 6);
  const monthlyGoals = [];
  if (received > 0) monthlyGoals.push(`حفظ یا رشد دریافتی نسبت به ${formatAfn(received)}`);
  if (newCustomers < 3) monthlyGoals.push('افزایش جذب مشتری جدید از مسیر بازاریابی و تماس');
  if (projects.overdue > 0) monthlyGoals.push('کاهش پروژه‌های تأخیری به صفر');
  if (crm.stuckInPipeline > 0) monthlyGoals.push('بازکردن گلوگاه مسیر فروش');

  return {
    insufficientData,
    overview: overviewParts.join(' '),
    goingWell: goingWell.length
      ? goingWell.map((f) => f.why)
      : insufficientData
        ? ['هنوز داده کافی برای شناسایی نقاط قوت وجود ندارد.']
        : ['عملکرد جاری در محدوده قابل قبول است؛ سیگنال ضعف فوری ثبت نشده.'],
    needsAttention: needsAttention.length
      ? needsAttention.map((f) => f.why)
      : insufficientData
        ? ['پس از ورود داده مالی و فروش، موارد نیازمند توجه مشخص می‌شود.']
        : ['مورد فوری نیازمند توجه شناسایی نشد.'],
    strengths: strengths.map((f) => f.why),
    weaknesses: weaknesses.map((f) => f.why),
    opportunities: opportunities.map((f) => f.why),
    weeklyStrategy: {
      summary: overviewParts[0],
      problems: needsAttention.slice(0, 5).map((f) => f.why),
      opportunities: opportunities.slice(0, 5).map((f) => f.why),
      priorities: weeklyTasks.slice(0, 4).map((f) => f.what),
      marketing:
        Number(marketing.contactMessagesThisMonth || 0) === 0
          ? ['پیگیری سرنخ‌های تماس و به‌روزرسانی نمونه‌کارهای منتشرشده']
          : [`${marketing.contactMessagesThisMonth} پیام تماس این ماه را ظرف ۴۸ ساعت پیگیری کنید`],
      sales:
        crm.stuckInPipeline > 0
          ? [`${crm.stuckInPipeline} مشتری متوقف‌شده را اولویت پیگیری فروش قرار دهید`]
          : ['مسیر فروش را روزانه بازبینی و نزدیک‌ترین قراردادها را ببندید'],
      customers:
        newCustomers < 2
          ? ['برنامه تماس با مشتریان قبلی برای سفارش تکراری']
          : ['حفظ مشتریان جدید با پیگیری کیفیت تحویل'],
      operations:
        Number(projects.overdue || 0) > 0
          ? [`${projects.overdue} پروژه تأخیری را در جلسه تولید تعیین تکلیف کنید`]
          : ['مهلت پروژه‌های فعال را کنترل کنید'],
      employees:
        Number(hr.projectsPerPerson || 0) > 3
          ? [`بار کاری حدود ${hr.projectsPerPerson} پروژه برای هر نفر است — توزیع کار را بازبینی کنید`]
          : [],
      tasks: weeklyTasks,
    },
    monthlyStrategy: {
      overview: overviewParts.join(' '),
      strengths: strengths.map((f) => f.why),
      weaknesses: weaknesses.map((f) => f.why),
      growthOpportunities: opportunities.map((f) => f.why),
      marketingStrategy:
        Number(marketing.portfolioPublished || 0) < 5
          ? 'نمونه‌کارهای جدید منتشر کنید و سرنخ‌های تماس را به مسیر فروش وصل کنید.'
          : 'از نمونه‌کارهای موجود برای کمپین جذب مشتری و پیشنهاد پکیج استفاده کنید.',
      salesStrategy:
        crm.stuckInPipeline > 0
          ? 'تمرکز ماه: تبدیل مشتریان در انتظار تصمیم و بیعانه با پیگیری روزانه.'
          : 'تمرکز ماه: افزایش تبدیل سرنخ‌های جدید و بسته‌های مشتریان تکراری.',
      customerGrowthStrategy:
        newCustomers < 3
          ? 'ترکیب بازاریابی محتوایی، پیگیری واتساپ، و پیشنهاد به مشتریان قبلی.'
          : 'حفظ مشتریان جدید و تعریف مسیر سفارش تکراری.',
      revenueOpportunities: [
        receivable > 0 ? `وصول مطالبات ${formatAfn(receivable)}` : null,
        'پکیج خدمات برای مشتریان تکراری',
      ].filter(Boolean),
      operationalImprovements:
        Number(projects.overdue || 0) > 0
          ? ['کاهش تأخیر پروژه‌ها و شفاف‌کردن مسئول هر پروژه تأخیری']
          : ['پایدار نگه‌داشتن زمان تحویل'],
      goals: monthlyGoals,
      actions: recommendedActions,
      kpis: [
        {
          label: 'درآمد ماه',
          target: received > 0 ? Math.round(received * 1.1) : null,
          note: received > 0 ? '۱۰٪ رشد نسبت به ماه جاری در صورت پایداری فروش' : 'پس از اولین دریافتی قابل تعیین است',
        },
        {
          label: 'مشتریان جدید',
          target: Math.max(3, newCustomers + 1),
          note: 'حداقل هدف جذب ماهانه',
        },
        {
          label: 'پروژه‌های تکمیل‌شده',
          target: Math.max(2, Number(projects.completedThisMonth || 0) + 1),
          note: 'بر اساس ظرفیت تیم',
        },
      ],
    },
    recommendedActions,
    kpis: {
      received,
      previousReceived: Number(prev.received || 0),
      netProfit,
      previousNetProfit: Number(prev.netCompanyProfit || 0),
      receivable,
      newCustomers,
      previousNewCustomers: Number(sales.newCustomersPrevMonth || 0),
      activeProjects,
      overdueProjects: Number(projects.overdue || 0),
      completedThisMonth: Number(projects.completedThisMonth || 0),
      stuckInPipeline: Number(crm.stuckInPipeline || 0),
      followUpsDue: Number(crm.followUpsDue || 0),
      contactMessagesThisMonth: Number(marketing.contactMessagesThisMonth || 0),
      portfolioPublished: Number(marketing.portfolioPublished || 0),
      teamSize: Number(hr.teamSize || 0),
      projectsPerPerson: Number(hr.projectsPerPerson || 0),
      trends,
    },
    pipeline: crm.pipeline || [],
  };
}
