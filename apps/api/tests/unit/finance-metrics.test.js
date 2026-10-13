import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allocateSalaryPayment,
  derivePnlPerformance,
  directProjectCosts,
  emptyMonthlyActuals,
  employeeNetPayable,
  fixedSalaryForRange,
  isCurrentPnlMonth,
  salaryMonthsInRange,
  netCompanyProfit,
  pnlMonthBounds,
  priorCalendarMonth,
  projectProfit,
  remainingBalance,
  roundMoney,
  targetMetForMonth,
  parseDateBound,
} from '../../src/modules/finance/metrics.js';
import {
  afghanMonthBounds,
  afghanToGregorian,
  gregorianToAfghan,
  isAfghanYear,
} from '../../src/modules/finance/afghan-calendar.js';
import {
  deriveSettlementStatus,
  paymentBelongsToProject,
} from '../../src/modules/finance/service.js';
import {
  contractVideoCostInRange,
  projectFinanceMetrics,
  resolveContractPrice,
  resolvePaymentProjectId,
} from '../../src/modules/finance/kpis.js';

test('direct project costs = narrator + editor + other', () => {
  assert.equal(directProjectCosts({ narratorCost: 1000, editorCost: 2000, otherDirectCosts: 500 }), 3500);
});

test('project profit = revenue − direct costs', () => {
  assert.equal(projectProfit(10000, 3500), 6500);
  assert.equal(projectProfit(0, 400), -400);
});

test('net company profit = project profit − company expenses − fixed salaries', () => {
  assert.equal(netCompanyProfit(6500, 1500), 5000);
  assert.equal(netCompanyProfit(6500, 1500, 800), 4200);
});

test('receivable / remaining balance floors at zero', () => {
  assert.equal(remainingBalance(10000, 4000), 6000);
  assert.equal(remainingBalance(10000, 12000), 0);
});

test('employee net payable deducts payments and advances', () => {
  assert.equal(
    employeeNetPayable({ grossPayable: 20000, paidTotal: 5000, openAdvances: 2000 }),
    13000,
  );
  assert.equal(
    employeeNetPayable({ grossPayable: 1000, paidTotal: 800, openAdvances: 500 }),
    0,
  );
});

function afghanLocal(jy, jm, jd, hour = 12) {
  const g = afghanToGregorian(jy, jm, jd);
  return new Date(g.gy, g.gm - 1, g.gd, hour);
}

test('salary months count Afghan months touched, clamped to salary start and now', () => {
  const salaryStart = afghanLocal(1405, 6, 4);
  const now = afghanLocal(1405, 7, 21);
  // All time: Sonbola + Mizan.
  assert.equal(salaryMonthsInRange({ salaryStart, now }), 2);
  // This month (Mizan 1 → today).
  assert.equal(
    salaryMonthsInRange({ salaryStart, from: afghanLocal(1405, 7, 1, 0), to: now, now }),
    1,
  );
  // A single day still belongs to one salary month.
  assert.equal(
    salaryMonthsInRange({ salaryStart, from: afghanLocal(1405, 7, 21, 0), to: now, now }),
    1,
  );
  // Before salary was set up / in the future → nothing owed.
  assert.equal(
    salaryMonthsInRange({ salaryStart, from: afghanLocal(1405, 4, 1), to: afghanLocal(1405, 5, 30), now }),
    0,
  );
  assert.equal(
    salaryMonthsInRange({ salaryStart, from: afghanLocal(1405, 8, 1), to: afghanLocal(1405, 8, 30), now }),
    0,
  );
  // Gregorian month spanning two Afghan months is capped for single-month P&L.
  assert.equal(
    salaryMonthsInRange({
      salaryStart,
      from: new Date(2026, 8, 1),
      to: new Date(2026, 8, 30, 23, 59),
      now,
      maxMonths: 1,
    }),
    1,
  );
  assert.equal(salaryMonthsInRange({ salaryStart: null, now }), 0);
});

test('fixed salary owed = monthly amount × salary months', () => {
  const now = afghanLocal(1405, 7, 21);
  assert.equal(
    fixedSalaryForRange({ monthlyAmount: 20000, salaryStart: afghanLocal(1405, 6, 4), now }),
    40000,
  );
  // Old payments no longer wipe out a later month: 40,000 owed − 20,000 paid.
  assert.equal(
    employeeNetPayable({
      grossPayable: fixedSalaryForRange({
        monthlyAmount: 20000,
        salaryStart: afghanLocal(1405, 6, 4),
        now,
      }),
      paidTotal: 20000,
    }),
    20000,
  );
});

test('allocate salary payment marks full payables FIFO', () => {
  const { remainingPayment, updates } = allocateSalaryPayment(
    [
      { id: 'a', amount: 3000 },
      { id: 'b', amount: 4000 },
      { id: 'c', amount: 5000 },
    ],
    7000,
  );
  assert.equal(remainingPayment, 0);
  assert.equal(updates.length, 2);
  assert.equal(updates[0].id, 'a');
  assert.equal(updates[0].fullyPaid, true);
  assert.equal(updates[1].id, 'b');
  assert.equal(updates[1].fullyPaid, true);
});

test('allocate salary payment reduces partial payable amount', () => {
  const { remainingPayment, updates } = allocateSalaryPayment(
    [{ id: 'a', amount: 5000 }],
    2000,
  );
  assert.equal(remainingPayment, 0);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].fullyPaid, false);
  assert.equal(updates[0].newAmount, 3000);
});

test('roundMoney stabilizes float noise', () => {
  assert.equal(roundMoney(10.005), 10.01);
});

test('empty monthly actuals are all zero', () => {
  assert.deepEqual(emptyMonthlyActuals(), {
    received: 0,
    receivable: 0,
    directProjectCosts: 0,
    projectProfit: 0,
    companyExpenses: 0,
    fixedSalaries: 0,
    netCompanyProfit: 0,
  });
});

test('prior calendar month rolls year boundary', () => {
  assert.deepEqual(priorCalendarMonth(2026, 1), { year: 2025, month: 12 });
  assert.deepEqual(priorCalendarMonth(2026, 8), { year: 2026, month: 7 });
  assert.deepEqual(priorCalendarMonth(1405, 1), { year: 1404, month: 12 });
});

test('Afghan / Gregorian conversion round-trips for PnL months', () => {
  assert.equal(isAfghanYear(1405), true);
  assert.equal(isAfghanYear(2026), false);
  const g = afghanToGregorian(1405, 7, 1);
  assert.ok(g);
  const back = gregorianToAfghan(g.gy, g.gm, g.gd);
  assert.deepEqual(back, { jy: 1405, jm: 7, jd: 1 });
});

test('Afghan month bounds are inclusive local civil days', () => {
  const { from, to } = afghanMonthBounds(1405, 7);
  assert.equal(from.getFullYear(), 2026);
  assert.equal(from.getMonth() + 1, 9);
  assert.equal(from.getDate(), 23);
  assert.equal(from.getHours(), 0);
  assert.equal(to.getFullYear(), 2026);
  assert.equal(to.getMonth() + 1, 10);
  assert.equal(to.getDate(), 22);
  assert.equal(to.getHours(), 23);
  assert.equal(to.getMinutes(), 59);

  const viaPnl = pnlMonthBounds(1405, 7);
  assert.equal(viaPnl.from.getTime(), from.getTime());
  assert.equal(viaPnl.to.getTime(), to.getTime());

  const gregorianSept = pnlMonthBounds(2026, 9);
  assert.equal(gregorianSept.from.getDate(), 1);
  assert.equal(gregorianSept.to.getDate(), 30);
});

test('isCurrentPnlMonth uses Afghan month when year is Afghan', () => {
  const sample = new Date(2026, 8, 27, 12, 0, 0, 0); // 27 Sep 2026 = میزان 5, 1405
  assert.equal(isCurrentPnlMonth(1405, 7, sample), true);
  assert.equal(isCurrentPnlMonth(1405, 6, sample), false);
  assert.equal(isCurrentPnlMonth(2026, 9, sample), true);
});

test('P&L performance inactive before target set', () => {
  assert.equal(derivePnlPerformance(50000, false), 'INACTIVE');
});

test('P&L performance profit loss break-even', () => {
  assert.equal(derivePnlPerformance(1000, true), 'PROFIT');
  assert.equal(derivePnlPerformance(-500, true), 'LOSS');
  assert.equal(derivePnlPerformance(0, true), 'BREAK_EVEN');
});

test('target met only when tracking active', () => {
  assert.equal(targetMetForMonth(120000, 100000, true), true);
  assert.equal(targetMetForMonth(90000, 100000, true), false);
  assert.equal(targetMetForMonth(120000, 100000, false), null);
});

test('project payments match by invoice.projectId first', () => {
  const project = {
    id: 'proj-a',
    crmCustomerId: 'cust-1',
    opportunity: { id: 'opp-a' },
  };
  assert.equal(
    paymentBelongsToProject(
      { invoice: { projectId: 'proj-a', opportunityId: 'opp-b' } },
      project,
    ),
    true,
  );
  assert.equal(
    paymentBelongsToProject(
      { invoice: { projectId: 'proj-b', opportunityId: 'opp-a' } },
      project,
    ),
    false,
  );
});

test('project payments match opportunity invoice when projectId unset', () => {
  const project = {
    id: 'proj-a',
    crmCustomerId: 'cust-1',
    opportunity: { id: 'opp-a' },
  };
  assert.equal(
    paymentBelongsToProject(
      { invoice: { projectId: null, opportunityId: 'opp-a' } },
      project,
    ),
    true,
  );
  assert.equal(
    paymentBelongsToProject(
      { invoice: { projectId: null, opportunityId: 'opp-b' } },
      project,
    ),
    false,
  );
});

test('direct payments assign to a single customer project only', () => {
  const indexes = {
    byProjectId: new Map([
      ['proj-a', { id: 'proj-a' }],
      ['proj-b', { id: 'proj-b' }],
    ]),
    byOpportunityId: new Map([
      ['opp-a', 'proj-a'],
      ['opp-b', 'proj-b'],
    ]),
    byCustomerId: new Map([
      ['cust-1', ['proj-a']],
      ['cust-2', ['proj-a', 'proj-b']],
    ]),
  };
  assert.equal(
    resolvePaymentProjectId(
      { invoiceId: null, crmCustomerId: 'cust-1', invoice: null },
      indexes,
    ),
    'proj-a',
  );
  assert.equal(
    resolvePaymentProjectId(
      { invoiceId: null, crmCustomerId: 'cust-2', invoice: null },
      indexes,
    ),
    null,
  );
});

test('projectFinanceMetrics uses verified payments not cache', () => {
  const project = {
    finance: {
      finalProjectPrice: 10000,
      narratorCost: 1000,
      editorCost: 2000,
      otherDirectCosts: 500,
      currency: 'AFN',
    },
    opportunity: null,
  };
  const m = projectFinanceMetrics(project, [
    { amount: 3000, verification: 'VERIFIED' },
    { amount: 1000, verification: 'PENDING' },
  ]);
  assert.equal(m.received, 3000);
  assert.equal(m.balance, 7000);
  assert.equal(m.directCosts, 3500);
  assert.equal(m.profit, 6500);
});

test('projectFinanceMetrics falls through zero finalProjectPrice to opportunity', () => {
  const project = {
    finance: {
      finalProjectPrice: 0,
      agreedPrice: 0,
      narratorCost: 0,
      editorCost: 0,
      otherDirectCosts: 0,
    },
    opportunity: { agreedPrice: 25000, currency: 'AFN' },
  };
  const m = projectFinanceMetrics(project, [
    { amount: 5000, verification: 'VERIFIED' },
  ]);
  assert.equal(m.finalProjectPrice, 25000);
  assert.equal(m.received, 5000);
  assert.equal(m.balance, 20000);
});

test('projectFinanceMetrics prefers positive finance.agreedPrice over zero final', () => {
  const project = {
    finance: {
      finalProjectPrice: 0,
      agreedPrice: 18000,
    },
    opportunity: { agreedPrice: 99999 },
  };
  const m = projectFinanceMetrics(project, []);
  assert.equal(m.finalProjectPrice, 18000);
});

test('resolveContractPrice ignores null/NaN and defaults to 0', () => {
  assert.equal(resolveContractPrice({ finance: null, opportunity: null }), 0);
  assert.equal(
    resolveContractPrice({
      finance: { finalProjectPrice: 'oops', agreedPrice: null },
      opportunity: { agreedPrice: undefined },
    }),
    0,
  );
});

test('deriveSettlementStatus maps payment progress to remaining states', () => {
  assert.equal(deriveSettlementStatus({ finalProjectPrice: 10000, received: 0 }), 'UNPAID');
  assert.equal(deriveSettlementStatus({ finalProjectPrice: 10000, received: 4000 }), 'PARTIAL');
  assert.equal(deriveSettlementStatus({ finalProjectPrice: 10000, received: 10000 }), 'PAID');
  assert.equal(deriveSettlementStatus({ finalProjectPrice: 10000, received: 12000 }), 'PAID');
});

test('parseDateBound treats YYYY-MM-DD as a local calendar day', () => {
  const from = parseDateBound('2026-09-08', false);
  const to = parseDateBound('2026-09-08', true);
  assert.ok(from);
  assert.ok(to);
  assert.equal(from.getFullYear(), 2026);
  assert.equal(from.getMonth(), 8);
  assert.equal(from.getDate(), 8);
  assert.equal(from.getHours(), 0);
  assert.equal(from.getMinutes(), 0);
  assert.equal(to.getFullYear(), 2026);
  assert.equal(to.getMonth(), 8);
  assert.equal(to.getDate(), 8);
  assert.equal(to.getHours(), 23);
  assert.equal(to.getMinutes(), 59);
});

test('parseDateBound returns null for empty or invalid values', () => {
  assert.equal(parseDateBound(null), null);
  assert.equal(parseDateBound(''), null);
  assert.equal(parseDateBound('not-a-date'), null);
});

test('contractVideoCostInRange scopes contract video costs by created/completed date', () => {
  const from = new Date('2026-10-01T00:00:00Z');
  const to = new Date('2026-10-31T23:59:59Z');
  const createdInRange = { createdAt: '2026-10-12T18:03:21Z', completedAt: null };
  const completedInRange = {
    createdAt: '2026-09-20T10:00:00Z',
    completedAt: '2026-10-05T10:00:00Z',
  };
  const outOfRange = {
    createdAt: '2026-09-20T10:00:00Z',
    completedAt: '2026-09-25T10:00:00Z',
  };

  assert.equal(contractVideoCostInRange(outOfRange, null, null), true);
  assert.equal(contractVideoCostInRange(createdInRange, from, to), true);
  assert.equal(contractVideoCostInRange(completedInRange, from, to), true);
  assert.equal(contractVideoCostInRange(outOfRange, from, to), false);
});
