import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBusinessSignals } from '../../src/modules/business-assistant/rules.js';

function snapshot(overrides = {}) {
  return {
    finance: {
      month: { received: 100000, netCompanyProfit: 20000, projectProfit: 30000 },
      previousMonth: { received: 120000, netCompanyProfit: 25000 },
      allTime: { receivable: 50000 },
      trends: { revenuePct: -17, netProfitPct: -20, newCustomersPct: -10 },
      pnlTarget: { targetNetProfit: 30000 },
      openPayables: 10000,
    },
    crm: {
      pipeline: [
        { stage: 'WAITING_DECISION', count: 5 },
        { stage: 'DEPOSIT_PENDING', count: 2 },
        { stage: 'REPEAT_CUSTOMER', count: 3 },
      ],
      stuckInPipeline: 7,
      followUpsDue: 4,
    },
    projects: { active: 12, overdue: 2 },
    hr: { teamSize: 5 },
    sales: { newCustomersThisMonth: 1, newCustomersPrevMonth: 1 },
    marketing: { contactMessagesThisMonth: 0, portfolioPublished: 2 },
    strategy: { insightsInProgress: 6, insightsDoneLast30Days: 1 },
    targetProgress: { overallPct: 35, progress: {} },
    facts: [],
    ...overrides,
  };
}

test('profit gap below target creates weakness signal', () => {
  const signals = evaluateBusinessSignals(snapshot());
  const hit = signals.find((s) => s.kind === 'PROFIT_GAP' && s.strengthOrWeakness === 'WEAKNESS');
  assert.ok(hit);
  assert.equal(hit.priority, 'HIGH');
});

test('high receivable ratio creates risk signal', () => {
  const signals = evaluateBusinessSignals(
    snapshot({
      finance: {
        month: { received: 100000, netCompanyProfit: 20000 },
        allTime: { receivable: 60000 },
        openPayables: 0,
      },
    }),
  );
  assert.ok(signals.some((s) => s.kind === 'RECEIVABLE_HIGH'));
});

test('pipeline bottleneck detected when stuck customers high', () => {
  const signals = evaluateBusinessSignals(snapshot());
  assert.ok(signals.some((s) => s.kind === 'PIPELINE_BOTTLENECK'));
});

test('overdue projects create risk signal', () => {
  const signals = evaluateBusinessSignals(snapshot());
  assert.ok(signals.some((s) => s.kind === 'OVERDUE_PROJECTS'));
});

test('repeat customers create opportunity signal', () => {
  const signals = evaluateBusinessSignals(snapshot());
  assert.ok(signals.some((s) => s.kind === 'REPEAT_REVENUE'));
});

test('team overload when projects per person too high', () => {
  const signals = evaluateBusinessSignals(
    snapshot({ projects: { active: 25, overdue: 0 }, hr: { teamSize: 5 } }),
  );
  assert.ok(signals.some((s) => s.kind === 'EMPLOYEE_CAPACITY'));
});

test('revenue decline creates weakness trend signal', () => {
  const signals = evaluateBusinessSignals(snapshot());
  const hit = signals.find((s) => s.kind === 'REVENUE_TREND' && s.strengthOrWeakness === 'WEAKNESS');
  assert.ok(hit);
});

test('low lead generation creates marketing weakness signal', () => {
  const signals = evaluateBusinessSignals(snapshot());
  assert.ok(signals.some((s) => s.kind === 'LEAD_GENERATION'));
});

test('low marketing presence creates opportunity signal', () => {
  const signals = evaluateBusinessSignals(snapshot());
  assert.ok(signals.some((s) => s.kind === 'MARKETING_ENGAGEMENT'));
});

test('stalled strategy follow-up creates risk signal', () => {
  const signals = evaluateBusinessSignals(snapshot());
  assert.ok(signals.some((s) => s.kind === 'STRATEGY_FOLLOWUP'));
});

test('monthly target behind schedule creates strategy risk after mid-month', () => {
  if (new Date().getDate() < 15) return;
  const signals = evaluateBusinessSignals(snapshot());
  assert.ok(signals.some((s) => s.kind === 'MONTHLY_STRATEGY'));
});

test('composeBriefing uses snapshot numbers and signal-backed actions', async () => {
  const { composeBriefing } = await import('../../src/modules/business-assistant/briefing.js');
  const snap = snapshot();
  const signals = evaluateBusinessSignals(snap);
  const briefing = composeBriefing(snap, signals);
  assert.equal(briefing.insufficientData, false);
  assert.equal(briefing.kpis.received, 100000);
  assert.ok(briefing.overview.length > 20);
  assert.ok(briefing.recommendedActions.length > 0);
  assert.ok(briefing.weeklyStrategy.tasks.length > 0);
});
