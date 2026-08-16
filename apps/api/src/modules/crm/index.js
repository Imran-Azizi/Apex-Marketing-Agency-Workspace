import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission, requireInternal } from '../../middleware/rbac.js';
import { requireCsrf } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { ok, created } from '../../utils/response.js';
import {
  crmService,
  createCustomerSchema,
  updateCustomerSchema,
  updateOpportunityDetailsSchema,
  recordPaymentSchema,
  updatePaymentSchema,
  rejectPaymentSchema,
} from './service.js';

const router = Router();
router.use(requireAuth, requireInternal);

router.get('/form-options', requirePermission('crm.view'), async (req, res, next) => {
  try {
    ok(res, await crmService.getFormOptions());
  } catch (e) {
    next(e);
  }
});

router.get('/customers', requirePermission('crm.view'), async (req, res, next) => {
  try {
    ok(res, await crmService.listCustomers({
      q: req.query.q,
      source: req.query.source,
      salesOwnerId: req.query.salesOwnerId,
      page: Number(req.query.page || 1),
      pageSize: Number(req.query.pageSize || 20),
    }), { page: Number(req.query.page || 1) });
  } catch (e) {
    next(e);
  }
});

router.post('/customers', requireCsrf, requirePermission('crm.create'), validate(createCustomerSchema), async (req, res, next) => {
  try { created(res, await crmService.createCustomer(req.body, req.auth, req)); } catch (e) { next(e); }
});

router.post('/customers/check-duplicate', requirePermission('crm.view'), validate(z.object({ whatsapp: z.string() })), async (req, res, next) => {
  try { ok(res, await crmService.checkDuplicate(req.body.whatsapp)); } catch (e) { next(e); }
});

router.get('/customers/:id', requirePermission('crm.view'), async (req, res, next) => {
  try { ok(res, await crmService.getCustomer(req.params.id)); } catch (e) { next(e); }
});

router.patch('/customers/:id', requireCsrf, requirePermission('crm.edit'), validate(updateCustomerSchema), async (req, res, next) => {
  try { ok(res, await crmService.updateCustomer(req.params.id, req.body, req.auth, req)); } catch (e) { next(e); }
});

router.patch('/opportunities/:id', requireCsrf, requirePermission('crm.opportunity'), async (req, res, next) => {
  try { ok(res, await crmService.updateOpportunity(req.params.id, req.body, req.auth, req)); } catch (e) { next(e); }
});

router.patch('/opportunities/:id/details', requireCsrf, requirePermission('crm.opportunity'), validate(updateOpportunityDetailsSchema), async (req, res, next) => {
  try { ok(res, await crmService.updateOpportunityDetails(req.params.id, req.body, req.auth, req)); } catch (e) { next(e); }
});

router.post('/opportunities/:id/unlock-contract', requireCsrf, requirePermission('crm.opportunity'), async (req, res, next) => {
  try { ok(res, await crmService.unlockContractDetails(req.params.id, req.auth, req)); } catch (e) { next(e); }
});

router.post('/opportunities/:id/deposit-invoice', requireCsrf, requirePermission('finance.create', 'crm.opportunity'), async (req, res, next) => {
  try { created(res, await crmService.createDepositInvoice(req.params.id, req.body, req.auth, req)); } catch (e) { next(e); }
});

router.get('/opportunities/:id/invite-eligibility', requirePermission('crm.invite'), async (req, res, next) => {
  try { ok(res, await crmService.getInviteEligibility(req.params.id)); } catch (e) { next(e); }
});

router.post('/payments', requireCsrf, requirePermission('finance.create', 'crm.opportunity'), validate(recordPaymentSchema), async (req, res, next) => {
  try { created(res, await crmService.recordPayment(req.body, req.auth, req)); } catch (e) { next(e); }
});

router.patch('/payments/:id', requireCsrf, requirePermission('finance.edit', 'crm.opportunity'), validate(updatePaymentSchema), async (req, res, next) => {
  try { ok(res, await crmService.updatePayment(req.params.id, req.body, req.auth, req)); } catch (e) { next(e); }
});

router.delete('/payments/:id', requireCsrf, requirePermission('finance.delete', 'crm.opportunity'), async (req, res, next) => {
  try { ok(res, await crmService.deletePayment(req.params.id, req.auth, req)); } catch (e) { next(e); }
});

router.get('/payments/:id/receipt', requirePermission('crm.view', 'finance.view', 'crm.opportunity'), async (req, res, next) => {
  try { ok(res, await crmService.getPaymentReceipt(req.params.id)); } catch (e) { next(e); }
});

router.get('/payments/:id/receipt.html', requirePermission('crm.view', 'finance.view', 'crm.opportunity'), async (req, res, next) => {
  try {
    const html = await crmService.getPaymentReceiptHtml(req.params.id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="payment-receipt.html"`);
    res.send(html);
  } catch (e) { next(e); }
});

router.post('/payments/:id/verify', requireCsrf, requirePermission('finance.approve'), async (req, res, next) => {
  try { ok(res, await crmService.verifyPayment(req.params.id, req.auth, req)); } catch (e) { next(e); }
});

router.post('/payments/:id/reject', requireCsrf, requirePermission('finance.approve'), validate(rejectPaymentSchema), async (req, res, next) => {
  try { ok(res, await crmService.rejectPayment(req.params.id, req.body, req.auth, req)); } catch (e) { next(e); }
});
router.post('/opportunities/:id/portal-invite', requireCsrf, requirePermission('crm.invite'), async (req, res, next) => {
  try { created(res, await crmService.createPortalInvite(req.params.id, req.auth, req)); } catch (e) { next(e); }
});

router.post('/customers/:id/assets', requireCsrf, requirePermission('crm.edit'), async (req, res, next) => {
  try { created(res, await crmService.createClientAsset(req.params.id, req.body, req.auth, req)); } catch (e) { next(e); }
});

router.delete('/customers/:id', requireCsrf, requirePermission('crm.delete'), async (req, res, next) => {
  try { ok(res, await crmService.softDeleteCustomer(req.params.id, req.auth, req)); } catch (e) { next(e); }
});

router.post('/customers/merge', requireCsrf, requirePermission('crm.merge'), validate(z.object({
  survivorId: z.string().min(1),
  duplicateId: z.string().min(1),
})), async (req, res, next) => {
  try {
    ok(res, await crmService.mergeDuplicates(req.body, req.auth, req));
  } catch (e) { next(e); }
});

export default router;
