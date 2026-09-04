/**
 * Business analysis rules — deterministic signals from system snapshot.
 */

import { KINDS, CATEGORIES, SWOT } from "./constants.js";

function pct(part, whole) {
  if (!whole || whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function formatAfn(n) {
  return `${Math.round(Number(n) || 0).toLocaleString("en-US")} AFN`;
}

export function evaluateBusinessSignals(snapshot, settings = {}) {
  const signals = [];
  if (!snapshot) return signals;

  const receivableAlertPct = Math.max(
    5,
    Number(settings.receivableAlertPct) || 30,
  );
  const profitGapPct = Math.max(5, Number(settings.profitTargetGapPct) || 15);
  const overdueDays = Math.max(1, Number(settings.overdueProjectDays) || 3);
  const pipelineStuck = Math.max(3, Number(settings.pipelineStuckDays) || 7);

  const month = snapshot.finance?.month || {};
  const received = Number(month.received || 0);
  const netProfit = Number(month.netCompanyProfit || 0);
  const receivable = Number(snapshot.finance?.allTime?.receivable || 0);
  const target = snapshot.finance?.pnlTarget?.targetNetProfit;
  const openPayables = Number(snapshot.finance?.openPayables || 0);

  if (target && target > 0) {
    const gap = pct(target - netProfit, target);
    if (netProfit < target && gap >= profitGapPct) {
      signals.push({
        kind: KINDS.PROFIT_GAP,
        category: CATEGORIES.FINANCE,
        strengthOrWeakness: SWOT.WEAKNESS,
        priority: gap >= 30 ? "HIGH" : "MEDIUM",
        trigger: "profit_below_target",
        facts: [
          `سود خالص ماه: ${formatAfn(netProfit)}`,
          `هدف سود: ${formatAfn(target)}`,
          `شکاف: ${gap}%`,
        ],
        evidence: { netProfit, target, gapPct: gap },
      });
    } else if (netProfit >= target) {
      signals.push({
        kind: KINDS.PROFIT_GAP,
        category: CATEGORIES.FINANCE,
        strengthOrWeakness: SWOT.STRENGTH,
        priority: "LOW",
        trigger: "profit_on_target",
        facts: [
          `سود خالص ماه: ${formatAfn(netProfit)}`,
          `هدف سود: ${formatAfn(target)}`,
          "هدف ماهانه محقق شده است.",
        ],
        evidence: { netProfit, target },
      });
    }
  }

  if (received > 0) {
    const recPct = pct(receivable, received);
    if (recPct >= receivableAlertPct) {
      signals.push({
        kind: KINDS.RECEIVABLE_HIGH,
        category: CATEGORIES.FINANCE,
        strengthOrWeakness: SWOT.RISK,
        priority: recPct >= 50 ? "HIGH" : "MEDIUM",
        trigger: "receivable_ratio",
        facts: [
          `مطالبات: ${formatAfn(receivable)}`,
          `دریافتی ماه: ${formatAfn(received)}`,
          `نسبت مطالبات: ${recPct}%`,
        ],
        evidence: { receivable, received, recPct },
      });
    }
  }

  const stuck = Number(snapshot.crm?.stuckInPipeline || 0);
  if (stuck >= 3) {
    signals.push({
      kind: KINDS.PIPELINE_BOTTLENECK,
      category: CATEGORIES.CRM,
      strengthOrWeakness: SWOT.WEAKNESS,
      priority: stuck >= 8 ? "HIGH" : "MEDIUM",
      trigger: "pipeline_stuck",
      facts: [
        `${stuck} مشتری بیش از ${pipelineStuck} روز در مراحل تصمیم/بیعانه/پیشنهاد مانده‌اند.`,
        `پیگیری‌های سررسید: ${snapshot.crm?.followUpsDue || 0}`,
      ],
      evidence: { stuck, pipelineStuck },
    });
  }

  const overdue = Number(snapshot.projects?.overdue || 0);
  if (overdue > 0) {
    signals.push({
      kind: KINDS.OVERDUE_PROJECTS,
      category: CATEGORIES.PROJECTS,
      strengthOrWeakness: SWOT.RISK,
      priority: overdue >= 3 ? "HIGH" : "MEDIUM",
      trigger: "overdue_projects",
      facts: [
        `${overdue} پروژه فعال از مهلت ${overdueDays}+ روز گذشته است.`,
        `پروژه‌های فعال: ${snapshot.projects?.active || 0}`,
      ],
      evidence: { overdue, overdueDays },
    });
  }

  if (openPayables > 0 && received > 0 && openPayables / received > 0.4) {
    signals.push({
      kind: KINDS.PAYROLL_PRESSURE,
      category: CATEGORIES.HR,
      strengthOrWeakness: SWOT.RISK,
      priority: "MEDIUM",
      trigger: "payroll_pressure",
      facts: [
        `حقوق/پرداختنی باز: ${formatAfn(openPayables)}`,
        `دریافتی ماه: ${formatAfn(received)}`,
      ],
      evidence: { openPayables, received },
    });
  }

  const repeatStage = (snapshot.crm?.pipeline || []).find(
    (p) => p.stage === "REPEAT_CUSTOMER",
  );
  if (repeatStage && repeatStage.count >= 2) {
    signals.push({
      kind: KINDS.REPEAT_REVENUE,
      category: CATEGORIES.CRM,
      strengthOrWeakness: SWOT.OPPORTUNITY,
      priority: "MEDIUM",
      trigger: "repeat_customers",
      facts: [
        `${repeatStage.count} مشتری در مرحله سفارش تکراری هستند.`,
        "فرصت درآمد پایدار از مشتریان وفادار.",
      ],
      evidence: { repeatCount: repeatStage.count },
    });
  }

  const waitingDecision = (snapshot.crm?.pipeline || []).find(
    (p) => p.stage === "WAITING_DECISION",
  );
  const depositPending = (snapshot.crm?.pipeline || []).find(
    (p) => p.stage === "DEPOSIT_PENDING",
  );
  const conversionStuck =
    (waitingDecision?.count || 0) + (depositPending?.count || 0);
  if (conversionStuck >= 4) {
    signals.push({
      kind: KINDS.SALES_CONVERSION,
      category: CATEGORIES.CRM,
      strengthOrWeakness: SWOT.OPPORTUNITY,
      priority: "HIGH",
      trigger: "conversion_opportunity",
      facts: [
        `${waitingDecision?.count || 0} مشتری در انتظار تصمیم`,
        `${depositPending?.count || 0} مشتری در انتظار بیعانه`,
      ],
      evidence: {
        waitingDecision: waitingDecision?.count || 0,
        depositPending: depositPending?.count || 0,
      },
    });
  }

  const teamSize = Number(snapshot.hr?.teamSize || 0);
  const activeProjects = Number(snapshot.projects?.active || 0);
  if (teamSize > 0 && activeProjects / teamSize > 4) {
    signals.push({
      kind: KINDS.EMPLOYEE_CAPACITY,
      category: CATEGORIES.HR,
      strengthOrWeakness: SWOT.RISK,
      priority: "MEDIUM",
      trigger: "team_overload",
      facts: [
        `${activeProjects} پروژه فعال برای ${teamSize} نفر تیم`,
        "نسبت بار کاری بالا — ریسک تأخیر و کیفیت.",
      ],
      evidence: { activeProjects, teamSize },
    });
  }

  const revenueTrend = snapshot.finance?.trends?.revenuePct;
  const prevReceived = Number(snapshot.finance?.previousMonth?.received || 0);
  if (prevReceived > 0 && revenueTrend != null) {
    if (revenueTrend <= -15) {
      signals.push({
        kind: KINDS.REVENUE_TREND,
        category: CATEGORIES.FINANCE,
        strengthOrWeakness: SWOT.WEAKNESS,
        priority: revenueTrend <= -25 ? "HIGH" : "MEDIUM",
        trigger: "revenue_decline",
        facts: [
          `درآمد ماه ${formatAfn(received)} در مقایسه با ماه قبل ${revenueTrend}% کاهش یافته.`,
          `درآمد ماه قبل: ${formatAfn(prevReceived)}`,
        ],
        evidence: { revenueTrend, received, prevReceived },
      });
    } else if (revenueTrend >= 15) {
      signals.push({
        kind: KINDS.REVENUE_TREND,
        category: CATEGORIES.FINANCE,
        strengthOrWeakness: SWOT.STRENGTH,
        priority: "LOW",
        trigger: "revenue_growth",
        facts: [
          `درآمد ماه ${formatAfn(received)} — ${revenueTrend}% رشد نسبت به ماه قبل.`,
          "فرصت سرمایه‌گذاری در بازاریابی و توسعه ظرفیت.",
        ],
        evidence: { revenueTrend, received, prevReceived },
      });
    }
  }

  const newCustomers = Number(snapshot.sales?.newCustomersThisMonth || 0);
  const newCustomersPrev = Number(snapshot.sales?.newCustomersPrevMonth || 0);
  if (newCustomers < 2 && newCustomersPrev < 3) {
    signals.push({
      kind: KINDS.LEAD_GENERATION,
      category: CATEGORIES.MARKETING,
      strengthOrWeakness: SWOT.WEAKNESS,
      priority: "MEDIUM",
      trigger: "low_customer_acquisition",
      facts: [
        `مشتریان جدید این ماه: ${newCustomers}`,
        `مشتریان جدید ماه قبل: ${newCustomersPrev}`,
        "نیاز به تقویت بازاریابی و جذب سرنخ.",
      ],
      evidence: { newCustomers, newCustomersPrev },
    });
  }

  const contactMessages = Number(
    snapshot.marketing?.contactMessagesThisMonth || 0,
  );
  const portfolioCount = Number(snapshot.marketing?.portfolioPublished || 0);
  if (contactMessages === 0 && portfolioCount < 5) {
    signals.push({
      kind: KINDS.MARKETING_ENGAGEMENT,
      category: CATEGORIES.MARKETING,
      strengthOrWeakness: SWOT.OPPORTUNITY,
      priority: "MEDIUM",
      trigger: "low_marketing_presence",
      facts: [
        `پیام تماس این ماه: ${contactMessages}`,
        `نمونه‌کار منتشرشده: ${portfolioCount}`,
        "تقویت حضور دیجیتال و نمونه‌کارها می‌تواند جذب مشتری را افزایش دهد.",
      ],
      evidence: { contactMessages, portfolioCount },
    });
  } else if (contactMessages >= 5) {
    signals.push({
      kind: KINDS.MARKETING_ENGAGEMENT,
      category: CATEGORIES.MARKETING,
      strengthOrWeakness: SWOT.STRENGTH,
      priority: "LOW",
      trigger: "marketing_interest",
      facts: [
        `${contactMessages} پیام تماس در ماه جاری — علاقه بازار به خدمات.`,
        "پیگیری سریع سرنخ‌ها برای تبدیل به مشتری.",
      ],
      evidence: { contactMessages },
    });
  }

  const inProgress = Number(snapshot.strategy?.insightsInProgress || 0);
  const doneRecently = Number(snapshot.strategy?.insightsDoneLast30Days || 0);
  if (inProgress >= 5 && doneRecently < 2) {
    signals.push({
      kind: KINDS.STRATEGY_FOLLOWUP,
      category: CATEGORIES.STRATEGY,
      strengthOrWeakness: SWOT.RISK,
      priority: "MEDIUM",
      trigger: "strategy_stalled",
      facts: [
        `${inProgress} توصیه در حال پیگیری اما فقط ${doneRecently} مورد در ۳۰ روز اخیر تکمیل شده.`,
        "اجرای استراتژی‌های قبلی متوقف شده — نیاز به بازبینی اولویت‌ها.",
      ],
      evidence: { inProgress, doneRecently },
    });
  }

  const targetProgress = snapshot.targetProgress;
  if (targetProgress?.overallPct != null && targetProgress.overallPct < 50) {
    const dayOfMonth = new Date().getDate();
    if (dayOfMonth >= 15) {
      signals.push({
        kind: KINDS.MONTHLY_STRATEGY,
        category: CATEGORIES.STRATEGY,
        strengthOrWeakness: SWOT.RISK,
        priority: "HIGH",
        trigger: "monthly_target_behind",
        facts: [
          `پیشرفت کلی اهداف ماه: ${targetProgress.overallPct}%`,
          "نیاز به بازنگری برنامه عملیاتی ماهانه و تمرکز منابع.",
        ],
        evidence: {
          overallPct: targetProgress.overallPct,
          progress: targetProgress.progress,
        },
      });
    }
  }

  return signals;
}

export function buildWeeklyStrategySignals(snapshot) {
  return [
    {
      kind: KINDS.WEEKLY_STRATEGY,
      category: CATEGORIES.STRATEGY,
      strengthOrWeakness: SWOT.OPPORTUNITY,
      priority: "MEDIUM",
      trigger: "weekly_strategy",
      facts: snapshot?.facts || [],
      evidence: {
        period: snapshot?.period,
        swotSummary: snapshot?.strategy?.swotSummary,
        trends: snapshot?.finance?.trends,
      },
    },
  ];
}

export function buildMonthlyStrategySignals(snapshot) {
  return [
    {
      kind: KINDS.MONTHLY_STRATEGY,
      category: CATEGORIES.STRATEGY,
      strengthOrWeakness: SWOT.OPPORTUNITY,
      priority: "MEDIUM",
      trigger: "monthly_strategy",
      facts: snapshot?.facts || [],
      evidence: {
        targetProgress: snapshot?.targetProgress,
        trends: snapshot?.finance?.trends,
        swotSummary: snapshot?.strategy?.swotSummary,
      },
    },
  ];
}
