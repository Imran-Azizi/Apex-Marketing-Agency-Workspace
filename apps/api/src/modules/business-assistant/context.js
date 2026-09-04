/**
 * Aggregate business snapshot from finance, CRM, projects, HR, marketing, and trends.
 */

import { prisma } from '../../db/prisma.js';
import { computeFinanceKpis } from '../finance/kpis.js';
import { stageLabel } from '../crm/pipeline.js';
import { projectService } from '../projects/service.js';
import { getSettings } from './settings.js';

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function pctChange(current, previous) {
  const cur = Number(current) || 0;
  const prev = Number(previous) || 0;
  if (prev <= 0) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 100);
}

export function computeTargetProgress(snapshot, monthlyTarget) {
  if (!monthlyTarget?.targets) return null;
  const targets = monthlyTarget.targets;
  const actual = {
    revenue: Number(snapshot?.finance?.month?.received || 0),
    newCustomers: Number(snapshot?.sales?.newCustomersThisMonth || 0),
    projectsCompleted: Number(snapshot?.sales?.projectsCompletedThisMonth || 0),
    netProfit: Number(snapshot?.finance?.month?.netCompanyProfit || 0),
  };

  const progress = {};
  for (const key of ['revenue', 'newCustomers', 'projectsCompleted', 'netProfit']) {
    const target = Number(targets[key] || 0);
    progress[key] = {
      target,
      actual: actual[key],
      pct: target > 0 ? Math.min(150, Math.round((actual[key] / target) * 100)) : null,
    };
  }

  const values = Object.values(progress).map((p) => p.pct).filter((v) => v != null);
  const overallPct = values.length
    ? Math.round(values.reduce((s, v) => s + v, 0) / values.length)
    : null;

  return { actual, progress, overallPct };
}

export async function loadBusinessSnapshot(auth = null, options = {}) {
  const now = new Date();
  const monthFrom = startOfMonth(now);
  const monthTo = endOfMonth(now);
  const weekFrom = startOfWeek(now);
  const prevMonthFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthTo = endOfMonth(prevMonthFrom);

  const settings = options.settings || (await getSettings());
  const pipelineStuckDays = Math.max(3, Number(settings.pipelineStuckDays) || 7);
  const stuckThreshold = daysAgo(pipelineStuckDays);
  const thirtyDaysAgo = daysAgo(30);

  const [
    monthKpis,
    prevMonthKpis,
    allTimeKpis,
    projectDash,
    pipelineGroups,
    overdueProjects,
    activeProjects,
    employees,
    salaryAgg,
    salesAssistantOpen,
    monthlyTarget,
    stuckCustomers,
    newCustomersMonth,
    newCustomersPrev,
    projectsCompletedMonth,
    contactMessagesMonth,
    portfolioPublished,
    insightsDoneMonth,
    insightsInProgress,
    openInsightSwot,
  ] = await Promise.all([
    computeFinanceKpis({ from: monthFrom, to: monthTo }),
    computeFinanceKpis({ from: prevMonthFrom, to: prevMonthTo }),
    computeFinanceKpis({}),
    projectService.dashboard(auth),
    prisma.crmCustomer.groupBy({
      by: ['pipelineStage'],
      where: { deletedAt: null },
      _count: true,
    }),
    prisma.project.count({
      where: {
        deletedAt: null,
        status: { notIn: ['COMPLETED', 'CANCELED'] },
        deadlineAt: { lt: now },
      },
    }),
    prisma.project.count({
      where: {
        deletedAt: null,
        status: { notIn: ['COMPLETED', 'CANCELED', 'ON_HOLD'] },
      },
    }),
    prisma.teamProfile.findMany({
      where: { deletedAt: null, user: { deletedAt: null, isActive: true } },
      select: { id: true, displayName: true, kind: true, userId: true },
      take: 50,
    }),
    prisma.employeePayable.aggregate({
      _sum: { amount: true },
      where: { status: { in: ['ESTIMATED', 'CONFIRMED'] } },
    }),
    prisma.salesAssistantRecommendation.count({
      where: {
        supersededAt: null,
        actionState: { in: ['NEW', 'VIEWED', 'IN_PROGRESS'] },
        priority: 'HIGH',
      },
    }),
    prisma.businessAssistantMonthlyTarget?.findFirst({
      where: {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        status: { in: ['DRAFT', 'ACTIVE'] },
      },
    }) || null,
    prisma.crmCustomer.count({
      where: {
        deletedAt: null,
        pipelineStage: { in: ['WAITING_DECISION', 'DEPOSIT_PENDING', 'PROPOSAL_PRICE_SENT'] },
        updatedAt: { lt: stuckThreshold },
      },
    }),
    prisma.crmCustomer.count({
      where: {
        deletedAt: null,
        convertedAt: { gte: monthFrom, lte: monthTo },
      },
    }),
    prisma.crmCustomer.count({
      where: {
        deletedAt: null,
        convertedAt: { gte: prevMonthFrom, lte: prevMonthTo },
      },
    }),
    prisma.project.count({
      where: {
        deletedAt: null,
        status: 'COMPLETED',
        updatedAt: { gte: monthFrom, lte: monthTo },
      },
    }),
    prisma.contactMessage.count({
      where: { createdAt: { gte: monthFrom, lte: monthTo } },
    }),
    prisma.portfolioItem.count({
      where: { deletedAt: null, status: 'PUBLISHED' },
    }),
    prisma.businessAssistantInsight.count({
      where: {
        actionState: 'DONE',
        actedAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.businessAssistantInsight.count({
      where: {
        supersededAt: null,
        actionState: 'IN_PROGRESS',
      },
    }),
    prisma.businessAssistantInsight.groupBy({
      by: ['strengthOrWeakness'],
      where: {
        supersededAt: null,
        actionState: { in: ['NEW', 'VIEWED', 'IN_PROGRESS'] },
      },
      _count: true,
    }),
  ]);

  const pnlTarget = await prisma.financePnlTarget.findFirst({
    where: { year: now.getFullYear(), month: now.getMonth() + 1 },
  });

  const pipeline = pipelineGroups.map((g) => ({
    stage: g.pipelineStage,
    label: stageLabel(g.pipelineStage),
    count: g._count,
  }));

  const trends = {
    revenuePct: pctChange(monthKpis.received, prevMonthKpis.received),
    netProfitPct: pctChange(monthKpis.netCompanyProfit, prevMonthKpis.netCompanyProfit),
    newCustomersPct: pctChange(newCustomersMonth, newCustomersPrev),
    previousMonth: {
      received: prevMonthKpis.received,
      netCompanyProfit: prevMonthKpis.netCompanyProfit,
      newCustomers: newCustomersPrev,
    },
  };

  const swotSummary = { STRENGTH: 0, WEAKNESS: 0, RISK: 0, OPPORTUNITY: 0 };
  for (const row of openInsightSwot) {
    if (row.strengthOrWeakness && swotSummary[row.strengthOrWeakness] != null) {
      swotSummary[row.strengthOrWeakness] += row._count;
    }
  }

  const targetProgress = computeTargetProgress(
    {
      finance: { month: monthKpis },
      sales: { newCustomersThisMonth: newCustomersMonth, projectsCompletedThisMonth: projectsCompletedMonth },
    },
    monthlyTarget,
  );

  const facts = [
    `درآمد ماه جاری: ${monthKpis.received} AFN (${trends.revenuePct >= 0 ? '+' : ''}${trends.revenuePct}% نسبت به ماه قبل)`,
    `سود خالص ماه: ${monthKpis.netCompanyProfit} AFN (${trends.netProfitPct >= 0 ? '+' : ''}${trends.netProfitPct}% نسبت به ماه قبل)`,
    `مطالبات: ${allTimeKpis.receivable} AFN`,
    `مشتریان جدید این ماه: ${newCustomersMonth}`,
    `پروژه‌های تکمیل‌شده این ماه: ${projectsCompletedMonth}`,
    `پروژه‌های فعال: ${activeProjects} · تأخیری: ${overdueProjects}`,
    `مشتریان متوقف‌شده در مسیر فروش (${pipelineStuckDays}+ روز): ${stuckCustomers}`,
    `پیام‌های تماس این ماه: ${contactMessagesMonth}`,
    `نمونه‌کارهای منتشرشده: ${portfolioPublished}`,
    `توصیه‌های فروش با اولویت بالا: ${salesAssistantOpen}`,
    `توصیه‌های انجام‌شده ۳۰ روز اخیر: ${insightsDoneMonth}`,
    `توصیه‌های در حال پیگیری: ${insightsInProgress}`,
  ];

  return {
    generatedAt: now.toISOString(),
    period: {
      monthFrom: monthFrom.toISOString(),
      monthTo: monthTo.toISOString(),
      weekFrom: weekFrom.toISOString(),
      prevMonthFrom: prevMonthFrom.toISOString(),
      prevMonthTo: prevMonthTo.toISOString(),
    },
    finance: {
      month: monthKpis,
      previousMonth: prevMonthKpis,
      allTime: {
        receivable: allTimeKpis.receivable,
        received: allTimeKpis.received,
        netCompanyProfit: allTimeKpis.netCompanyProfit,
        projectProfit: allTimeKpis.projectProfit,
      },
      pnlTarget: pnlTarget
        ? { targetNetProfit: Number(pnlTarget.netProfitTarget || 0) }
        : null,
      openPayables: Number(salaryAgg._sum.amount || 0),
      trends,
    },
    crm: {
      pipeline,
      stuckInPipeline: stuckCustomers,
      leadsToday: projectDash.leadsToday,
      followUpsDue: projectDash.followUpsDue,
      pipelineStuckDays,
    },
    projects: {
      statusCounts: projectDash.projectStatusCounts,
      active: activeProjects,
      overdue: overdueProjects,
      completedThisMonth: projectsCompletedMonth,
    },
    sales: {
      newCustomersThisMonth: newCustomersMonth,
      newCustomersPrevMonth: newCustomersPrev,
      salesAssistantHighOpen: salesAssistantOpen,
    },
    marketing: {
      contactMessagesThisMonth: contactMessagesMonth,
      portfolioPublished,
      leadsToday: projectDash.leadsToday,
    },
    hr: {
      teamSize: employees.length,
      employees: employees.map((e) => ({ name: e.displayName, kind: e.kind })),
      openPayables: Number(salaryAgg._sum.amount || 0),
      projectsPerPerson: employees.length
        ? Math.round((activeProjects / employees.length) * 10) / 10
        : 0,
    },
    strategy: {
      insightsDoneLast30Days: insightsDoneMonth,
      insightsInProgress,
      swotSummary,
    },
    monthlyTarget: monthlyTarget || null,
    targetProgress,
    facts,
  };
}

export function compactSnapshotForAi(snapshot) {
  return {
    period: snapshot.period,
    finance: {
      received: snapshot.finance.month.received,
      netCompanyProfit: snapshot.finance.month.netCompanyProfit,
      receivable: snapshot.finance.allTime.receivable,
      projectProfit: snapshot.finance.month.projectProfit,
      companyExpenses: snapshot.finance.month.companyExpenses,
      pnlTarget: snapshot.finance.pnlTarget,
      openPayables: snapshot.finance.openPayables,
      trends: snapshot.finance.trends,
      previousMonth: {
        received: snapshot.finance.previousMonth?.received,
        netCompanyProfit: snapshot.finance.previousMonth?.netCompanyProfit,
      },
    },
    crm: {
      pipeline: snapshot.crm.pipeline,
      stuckInPipeline: snapshot.crm.stuckInPipeline,
      followUpsDue: snapshot.crm.followUpsDue,
      leadsToday: snapshot.crm.leadsToday,
    },
    projects: {
      active: snapshot.projects.active,
      overdue: snapshot.projects.overdue,
      completedThisMonth: snapshot.projects.completedThisMonth,
    },
    sales: snapshot.sales,
    marketing: snapshot.marketing,
    hr: {
      teamSize: snapshot.hr.teamSize,
      openPayables: snapshot.hr.openPayables,
      projectsPerPerson: snapshot.hr.projectsPerPerson,
    },
    strategy: snapshot.strategy,
    monthlyTarget: snapshot.monthlyTarget,
    targetProgress: snapshot.targetProgress,
    facts: snapshot.facts,
  };
}
