import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireInternal, requirePermission } from '../../middleware/rbac.js';
import { requireCsrf } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { ok, created } from '../../utils/response.js';
import {
  financeService,
  createExpenseSchema,
  updateExpenseSchema,
  salaryPaymentSchema,
  salaryAdvanceSchema,
  compensationSchema,
  pnlTargetSchema,
} from './service.js';

const router = Router();
router.use(requireAuth, requireInternal);

router.get('/dashboard', requirePermission('finance.view'), async (req, res, next) => {
  try {
    ok(
      res,
      await financeService.getDashboard({
        from: req.query.from,
        to: req.query.to,
      }),
    );
  } catch (e) {
    next(e);
  }
});

router.get('/projects', requirePermission('finance.view', 'projects.view'), async (req, res, next) => {
  try {
    ok(
      res,
      await financeService.listProjects({
        q: req.query.q,
      }),
    );
  } catch (e) {
    next(e);
  }
});

router.get('/expenses', requirePermission('finance.view'), async (req, res, next) => {
  try {
    ok(
      res,
      await financeService.listExpenses({
        from: req.query.from,
        to: req.query.to,
        page: Number(req.query.page || 1),
        pageSize: Number(req.query.pageSize || 50),
      }),
      { page: Number(req.query.page || 1) },
    );
  } catch (e) {
    next(e);
  }
});

router.post(
  '/expenses',
  requireCsrf,
  requirePermission('finance.create'),
  validate(createExpenseSchema),
  async (req, res, next) => {
    try {
      created(res, await financeService.createExpense(req.body, req.auth));
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  '/expenses/:id',
  requireCsrf,
  requirePermission('finance.edit'),
  validate(updateExpenseSchema),
  async (req, res, next) => {
    try {
      ok(res, await financeService.updateExpense(req.params.id, req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  '/expenses/:id',
  requireCsrf,
  requirePermission('finance.delete'),
  async (req, res, next) => {
    try {
      ok(res, await financeService.deleteExpense(req.params.id, req.auth));
    } catch (e) {
      next(e);
    }
  },
);

router.get('/payroll', requirePermission('finance.view'), async (req, res, next) => {
  try {
    ok(res, await financeService.listPayroll());
  } catch (e) {
    next(e);
  }
});

router.get('/payroll/employees/:teamProfileId', requirePermission('finance.view'), async (req, res, next) => {
  try {
    ok(res, await financeService.getEmployeePayroll(req.params.teamProfileId));
  } catch (e) {
    next(e);
  }
});

router.put(
  '/payroll/compensation',
  requireCsrf,
  requirePermission('finance.edit'),
  validate(compensationSchema),
  async (req, res, next) => {
    try {
      ok(res, await financeService.upsertCompensation(req.body));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/payroll/payments',
  requireCsrf,
  requirePermission('finance.create'),
  validate(salaryPaymentSchema),
  async (req, res, next) => {
    try {
      created(res, await financeService.recordSalaryPayment(req.body, req.auth));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/payroll/advances',
  requireCsrf,
  requirePermission('finance.create'),
  validate(salaryAdvanceSchema),
  async (req, res, next) => {
    try {
      created(res, await financeService.recordSalaryAdvance(req.body, req.auth));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/payroll/advances/:id/settle',
  requireCsrf,
  requirePermission('finance.edit'),
  async (req, res, next) => {
    try {
      ok(res, await financeService.settleAdvance(req.params.id));
    } catch (e) {
      next(e);
    }
  },
);

router.get('/pnl', requirePermission('finance.view'), async (req, res, next) => {
  try {
    const now = new Date();
    ok(
      res,
      await financeService.getPnlMonth({
        year: req.query.year || now.getFullYear(),
        month: req.query.month || now.getMonth() + 1,
      }),
    );
  } catch (e) {
    next(e);
  }
});

router.put(
  '/pnl/targets',
  requireCsrf,
  requirePermission('finance.edit'),
  validate(pnlTargetSchema),
  async (req, res, next) => {
    try {
      ok(res, await financeService.upsertPnlTarget(req.body, req.auth));
    } catch (e) {
      next(e);
    }
  },
);

router.get('/pnl/months', requirePermission('finance.view'), async (req, res, next) => {
  try {
    ok(res, await financeService.listPnlMonths());
  } catch (e) {
    next(e);
  }
});

export default router;
