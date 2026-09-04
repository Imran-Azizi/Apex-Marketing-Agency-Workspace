/**
 * Pure finance KPI / payroll math (unit-testable, no DB).
 * Maps client FA metrics → code fields.
 */

export function roundMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100) / 100;
}

export function money(v) {
  return roundMoney(v);
}

/** Direct project costs = narrator + editor + otherDirectCosts */
export function directProjectCosts({ narratorCost = 0, editorCost = 0, otherDirectCosts = 0 }) {
  return roundMoney(
    Number(narratorCost || 0) + Number(editorCost || 0) + Number(otherDirectCosts || 0),
  );
}

/** Project profit = project price − direct costs */
export function projectProfit(finalProjectPrice, costs) {
  return roundMoney(Number(finalProjectPrice || 0) - Number(costs || 0));
}

/** Net company profit = project profit − company expenses */
export function netCompanyProfit(projectProfitTotal, companyExpenses) {
  return roundMoney(Number(projectProfitTotal || 0) - Number(companyExpenses || 0));
}

/** Outstanding / receivable for one contract */
export function remainingBalance(projectTotal, verifiedPaid) {
  return roundMoney(Math.max(0, Number(projectTotal || 0) - Number(verifiedPaid || 0)));
}

/**
 * Employee net payable after salary payments and open advances.
 * grossPayable − paid − openAdvances (floored at 0)
 */
export function employeeNetPayable({ grossPayable = 0, paidTotal = 0, openAdvances = 0 }) {
  return roundMoney(
    Math.max(0, Number(grossPayable || 0) - Number(paidTotal || 0) - Number(openAdvances || 0)),
  );
}

/**
 * Apply a salary payment against ordered unpaid payable rows (FIFO).
 * Full rows are marked paid; a trailing partial reduces the payable amount.
 * Returns { remainingPayment, updates: [{ id, fullyPaid, applied, newAmount? }] }
 */
export function allocateSalaryPayment(unpaidRows, paymentAmount) {
  let left = roundMoney(paymentAmount);
  const updates = [];
  for (const row of unpaidRows) {
    if (left <= 0) break;
    const amount = roundMoney(row.amount);
    if (amount <= 0) continue;
    if (left >= amount - 0.009) {
      updates.push({ id: row.id, fullyPaid: true, applied: amount });
      left = roundMoney(left - amount);
    } else {
      updates.push({
        id: row.id,
        fullyPaid: false,
        applied: left,
        newAmount: roundMoney(amount - left),
      });
      left = 0;
      break;
    }
  }
  return { remainingPayment: left, updates };
}

export function parseDateBound(value, endOfDay = false) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (endOfDay) {
    d.setHours(23, 59, 59, 999);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

export function monthBounds(year, month) {
  const y = Number(year);
  const m = Number(month);
  const from = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const to = new Date(y, m, 0, 23, 59, 59, 999);
  return { from, to };
}

/** Zeroed monthly actuals — used before a month target is activated. */
export function emptyMonthlyActuals() {
  return {
    received: 0,
    receivable: 0,
    directProjectCosts: 0,
    projectProfit: 0,
    companyExpenses: 0,
    netCompanyProfit: 0,
  };
}

/** Resolve calendar month before (year, month). */
export function priorCalendarMonth(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (m <= 1) return { year: y - 1, month: 12 };
  return { year: y, month: m - 1 };
}

/**
 * Monthly performance state for the P&L tab.
 * INACTIVE = target not set for the month (figures stay at 0).
 */
export function derivePnlPerformance(netCompanyProfit, trackingActive) {
  if (!trackingActive) return 'INACTIVE';
  const net = roundMoney(netCompanyProfit);
  if (net > 0) return 'PROFIT';
  if (net < 0) return 'LOSS';
  return 'BREAK_EVEN';
}

/** Whether net profit met the monthly target (null when tracking inactive). */
export function targetMetForMonth(netCompanyProfit, netProfitTarget, trackingActive) {
  if (!trackingActive) return null;
  return roundMoney(netCompanyProfit) >= roundMoney(netProfitTarget) - 0.009;
}
