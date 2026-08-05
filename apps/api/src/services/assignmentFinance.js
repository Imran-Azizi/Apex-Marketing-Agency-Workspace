import { AppError } from '../utils/response.js';
import { computeFinanceFields } from './projectContext.js';

/**
 * Parse and validate a manager-entered assignment price (AFN).
 */
export function parseAssignmentAmount(raw, { fieldLabel = 'مبلغ' } = {}) {
  if (raw === undefined || raw === null || raw === '') {
    throw new AppError(`${fieldLabel} الزامی است`, 400, 'ASSIGNMENT_AMOUNT_REQUIRED');
  }
  const normalized = String(raw).replace(/,/g, '').trim();
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new AppError(`${fieldLabel} باید عددی نامنفی باشد`, 400, 'INVALID_ASSIGNMENT_AMOUNT');
  }
  return amount;
}

/**
 * One payable row per project + role label — update in place on reassignment (no duplicates).
 */
export async function upsertLaborPayable(
  tx,
  { projectId, teamProfileId, roleLabel, amount },
) {
  const existing = await tx.employeePayable.findFirst({
    where: { projectId, roleLabel },
  });

  const data = {
    teamProfileId,
    amount,
    status: existing?.status === 'PAID' ? 'PAID' : 'ESTIMATED',
  };

  if (existing) {
    return tx.employeePayable.update({
      where: { id: existing.id },
      data,
    });
  }

  return tx.employeePayable.create({
    data: {
      projectId,
      teamProfileId,
      roleLabel,
      amount,
      status: 'ESTIMATED',
    },
  });
}

/**
 * Roll narration/editor payables into ProjectFinance direct cost fields.
 */
export async function syncProjectLaborCosts(tx, projectId) {
  const [payables, finance] = await Promise.all([
    tx.employeePayable.findMany({
      where: { projectId, roleLabel: { in: ['NARRATOR', 'EDITOR'] } },
      select: { roleLabel: true, amount: true },
    }),
    tx.projectFinance.findUnique({ where: { projectId } }),
  ]);

  if (!finance) return null;

  const narratorCost = payables
    .filter((p) => p.roleLabel === 'NARRATOR')
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const editorCost = payables
    .filter((p) => p.roleLabel === 'EDITOR')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const calc = computeFinanceFields({
    agreedPrice: finance.agreedPrice,
    discount: finance.discount,
    narratorCost,
    editorCost,
    otherDirectCosts: finance.otherDirectCosts,
    received: finance.received,
  });

  return tx.projectFinance.update({
    where: { projectId },
    data: {
      narratorCost,
      editorCost,
      finalProjectPrice: calc.finalProjectPrice,
    },
  });
}
