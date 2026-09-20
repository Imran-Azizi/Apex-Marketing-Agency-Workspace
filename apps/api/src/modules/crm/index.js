import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission, requireInternal, requireRoles } from "../../middleware/rbac.js";
import { requireCsrf } from "../../middleware/csrf.js";
import { validate } from "../../middleware/validate.js";
import { ok, created } from "../../utils/response.js";
import { parsePagination } from "../../utils/pagination.js";
import {
  crmService,
  createCustomerSchema,
  updateCustomerSchema,
  updateOpportunityDetailsSchema,
  recordPaymentSchema,
  updatePaymentSchema,
  rejectPaymentSchema,
  addInteractionSchema,
  changeStageSchema,
  createInvoiceSchema,
  ingestWhatsappSchema,
  transferCustomersSchema,
  bulkDeleteCustomersSchema,
  createCustomerInvoiceSchema,
} from "./service.js";
import { portalInvitesService } from "./portalInvites.js";

const router = Router();
router.use(requireAuth, requireInternal);

router.get(
  "/form-options",
  requirePermission("crm.view"),
  async (req, res, next) => {
    try {
      ok(res, await crmService.getFormOptions());
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/dashboard",
  requirePermission("crm.view"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await crmService.getDashboard(req.auth, { scope: req.query.scope }),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/portal-invites",
  requirePermission("crm.invite", "crm.portal_credentials"),
  async (req, res, next) => {
    try {
      ok(res, await portalInvitesService.list(req.query, req.auth));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/customers",
  requirePermission("crm.view"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await crmService.listCustomers(
          {
            q: req.query.q,
            source: req.query.source,
            salesOwnerId: req.query.salesOwnerId,
            stage: req.query.stage,
            category: req.query.category,
            dateFrom: req.query.dateFrom,
            dateTo: req.query.dateTo,
            sort: req.query.sort,
            scope: req.query.scope,
            ...parsePagination(req.query, { defaultPageSize: 20, maxPageSize: 100 }),
          },
          req.auth,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/customers",
  requireCsrf,
  requirePermission("crm.create"),
  validate(createCustomerSchema),
  async (req, res, next) => {
    try {
      created(res, await crmService.createCustomer(req.body, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/customers/check-duplicate",
  requirePermission("crm.view"),
  validate(z.object({ whatsapp: z.string() })),
  async (req, res, next) => {
    try {
      ok(res, await crmService.checkDuplicate(req.body.whatsapp));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/customers/transfer",
  requireCsrf,
  requirePermission("crm.create"),
  validate(transferCustomersSchema),
  async (req, res, next) => {
    try {
      ok(res, await crmService.transferCustomers(req.body.ids, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/customers/bulk-delete",
  requireCsrf,
  requirePermission("crm.delete"),
  validate(bulkDeleteCustomersSchema),
  async (req, res, next) => {
    try {
      ok(
        res,
        await crmService.bulkDeleteCustomers(req.body.ids, req.auth, req),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/ingest/whatsapp",
  requireCsrf,
  requirePermission("crm.create"),
  validate(ingestWhatsappSchema),
  async (req, res, next) => {
    try {
      created(res, await crmService.ingestWhatsApp(req.body, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/customers/:id",
  requirePermission("crm.view"),
  async (req, res, next) => {
    try {
      ok(res, await crmService.getCustomer(req.params.id, { auth: req.auth }));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/customers/:id/reveal-portal-password",
  requireCsrf,
  requireRoles("MANAGER", "ADMIN"),
  requirePermission("crm.portal_credentials"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await portalInvitesService.revealPasswordForCustomer(
          req.params.id,
          req.auth,
          req,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/customers/:id/activity",
  requirePermission("crm.view"),
  async (req, res, next) => {
    try {
      ok(res, await crmService.getActivity(req.params.id, req.auth));
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/customers/:id",
  requireCsrf,
  requirePermission("crm.edit"),
  validate(updateCustomerSchema),
  async (req, res, next) => {
    try {
      ok(
        res,
        await crmService.updateCustomer(req.params.id, req.body, req.auth, req),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/customers/:id/interactions",
  requireCsrf,
  requirePermission("crm.edit"),
  validate(addInteractionSchema),
  async (req, res, next) => {
    try {
      created(
        res,
        await crmService.addInteraction(req.params.id, req.body, req.auth, req),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/customers/:id/stage",
  requireCsrf,
  requirePermission("crm.edit"),
  validate(changeStageSchema),
  async (req, res, next) => {
    try {
      ok(
        res,
        await crmService.changeStage(req.params.id, req.body, req.auth, req),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/customers/:id/convert",
  requireCsrf,
  requirePermission("crm.create"),
  async (req, res, next) => {
    try {
      ok(res, await crmService.convertCustomer(req.params.id, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/customers/:id/invoices",
  requirePermission("crm.view", "finance.view"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await crmService.listCustomerInvoices(req.params.id, req.auth),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/customers/:id/invoices",
  requireCsrf,
  requirePermission("finance.create", "crm.opportunity"),
  validate(createCustomerInvoiceSchema),
  async (req, res, next) => {
    try {
      created(
        res,
        await crmService.createCustomerInvoice(
          req.params.id,
          req.body,
          req.auth,
          req,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/opportunities/:id",
  requireCsrf,
  requirePermission("crm.opportunity"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await crmService.updateOpportunity(
          req.params.id,
          req.body,
          req.auth,
          req,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/opportunities/:id/details",
  requireCsrf,
  requirePermission("crm.opportunity"),
  validate(updateOpportunityDetailsSchema),
  async (req, res, next) => {
    try {
      ok(
        res,
        await crmService.updateOpportunityDetails(
          req.params.id,
          req.body,
          req.auth,
          req,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/opportunities/:id/unlock-contract",
  requireCsrf,
  requirePermission("crm.opportunity"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await crmService.unlockContractDetails(req.params.id, req.auth, req),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/opportunities/:id/deposit-invoice",
  requireCsrf,
  requirePermission("finance.create", "crm.opportunity"),
  validate(createInvoiceSchema),
  async (req, res, next) => {
    try {
      created(
        res,
        await crmService.createDepositInvoice(
          req.params.id,
          req.body,
          req.auth,
          req,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/opportunities/:id/invoice",
  requireCsrf,
  requirePermission("finance.create", "crm.opportunity"),
  validate(createInvoiceSchema),
  async (req, res, next) => {
    try {
      created(
        res,
        await crmService.createInvoice(req.params.id, req.body, req.auth, req),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/invoices/:id",
  requirePermission("crm.view", "finance.view"),
  async (req, res, next) => {
    try {
      ok(res, await crmService.getInvoiceView(req.params.id));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/invoices/:id/document.html",
  requirePermission("crm.view", "finance.view"),
  async (req, res, next) => {
    try {
      const html = await crmService.getInvoiceDocumentHtml(req.params.id);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        'inline; filename="apex-invoice.html"',
      );
      res.send(html);
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/opportunities/:id/invite-eligibility",
  requirePermission("crm.invite"),
  async (req, res, next) => {
    try {
      ok(res, await crmService.getInviteEligibility(req.params.id));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/payments",
  requireCsrf,
  requirePermission("finance.create", "crm.opportunity"),
  validate(recordPaymentSchema),
  async (req, res, next) => {
    try {
      created(res, await crmService.recordPayment(req.body, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/payments/:id",
  requireCsrf,
  requirePermission("finance.edit", "crm.opportunity"),
  validate(updatePaymentSchema),
  async (req, res, next) => {
    try {
      ok(
        res,
        await crmService.updatePayment(req.params.id, req.body, req.auth, req),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/payments/:id",
  requireCsrf,
  requirePermission("finance.delete", "crm.opportunity"),
  async (req, res, next) => {
    try {
      ok(res, await crmService.deletePayment(req.params.id, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/payments/:id/receipt",
  requirePermission("crm.view", "finance.view", "crm.opportunity"),
  async (req, res, next) => {
    try {
      ok(res, await crmService.getPaymentReceipt(req.params.id, req.auth));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/payments/:id/receipt.html",
  requirePermission("crm.view", "finance.view", "crm.opportunity"),
  async (req, res, next) => {
    try {
      const html = await crmService.getPaymentReceiptHtml(req.params.id, req.auth);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        'inline; filename="payment-receipt.html"',
      );
      res.send(html);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/payments/:id/verify",
  requireCsrf,
  requirePermission("finance.approve"),
  async (req, res, next) => {
    try {
      ok(res, await crmService.verifyPayment(req.params.id, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/payments/:id/reject",
  requireCsrf,
  requirePermission("finance.approve"),
  validate(rejectPaymentSchema),
  async (req, res, next) => {
    try {
      ok(
        res,
        await crmService.rejectPayment(req.params.id, req.body, req.auth, req),
      );
    } catch (e) {
      next(e);
    }
  },
);
router.post(
  "/opportunities/:id/portal-invite",
  requireCsrf,
  requirePermission("crm.invite"),
  async (req, res, next) => {
    try {
      created(
        res,
        await crmService.createPortalInvite(req.params.id, req.auth, req),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/customers/:id/assets",
  requirePermission("crm.view", "projects.create"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await crmService.listClientAssets(req.params.id, req.auth),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/customers/:id/assets",
  requireCsrf,
  requirePermission("crm.edit", "projects.create"),
  async (req, res, next) => {
    try {
      created(
        res,
        await crmService.createClientAsset(
          req.params.id,
          req.body,
          req.auth,
          req,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/customers/:id/assets/:assetId",
  requireCsrf,
  requirePermission("crm.edit", "projects.create"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await crmService.softDeleteClientAsset(
          req.params.id,
          req.params.assetId,
          req.auth,
          req,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/customers/:id",
  requireCsrf,
  requirePermission("crm.delete"),
  async (req, res, next) => {
    try {
      ok(
        res,
        await crmService.softDeleteCustomer(req.params.id, req.auth, req),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/customers/merge",
  requireCsrf,
  requirePermission("crm.merge"),
  validate(
    z.object({
      survivorId: z.string().min(1),
      duplicateId: z.string().min(1),
    }),
  ),
  async (req, res, next) => {
    try {
      ok(res, await crmService.mergeDuplicates(req.body, req.auth, req));
    } catch (e) {
      next(e);
    }
  },
);

export default router;
