import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/response.js';
import { normalizeWhatsapp } from '../../utils/whatsappNormalize.js';
import { writeAudit } from '../../middleware/audit.js';
import { randomToken } from '../../utils/tokens.js';
import {
  notifyManagersOnce,
  buildLeadCreatedNotification,
  createNotificationOnce,
} from '../../services/notifications.js';
import {
  LEAD_SOURCE_CODES,
  LEAD_SOURCE_LABELS,
  SALES_REP_ROLE_CODES,
} from './constants.js';
import { buildPaymentReceiptHtml } from './paymentReceiptHtml.js';
import {
  assertPaymentWithinRemaining,
  batchOpportunityFinanceSnapshots,
  computeFinanceSnapshot,
  getAvailableRemaining,
  syncCustomerOpportunitiesFinance,
  syncOpportunityFinance,
  syncProjectFinanceFromPayments,
} from './paymentFinance.js';
import {
  assertPaymentApprover,
  buildPaymentApprovedNotification,
  buildPaymentPendingApprovalNotification,
  buildPaymentRejectedNotification,
  resolvePaymentContext,
  shouldAutoApprovePayment,
} from './paymentApproval.js';

const optionalId = z.string().min(1).optional().or(z.literal('')).transform((v) => v || undefined);
const patchId = z.union([z.string().min(1), z.literal(''), z.null()]).optional();

export const createCustomerSchema = z.object({
  personName: z.string().min(2),
  companyName: z.string().optional(),
  jobTitle: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().min(8),
  city: z.string().optional(),
  address: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  source: z.string().optional(),
  sourceOther: z.string().optional(),
  salesOwnerId: optionalId,
  notes: z.string().optional(),
});

export const updateCustomerSchema = z.object({
  personName: z.string().min(2).optional(),
  companyName: z.string().optional(),
  jobTitle: z.string().optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  source: z.string().optional(),
  sourceOther: z.string().optional(),
  salesOwnerId: patchId,
  notes: z.string().optional(),
  nextFollowUpAt: z.string().datetime().optional().or(z.literal('')),
});

export const updateOpportunityDetailsSchema = z.object({
  agreedPrice: z.coerce.number().positive({ message: 'قیمت مجموعی پروژه الزامی است' }),
  /** @deprecated Ignored — advance/total paid is always derived from payment records. */
  advancePayment: z.coerce.number().nonnegative().optional().nullable(),
  agreedTerms: z.string().min(1, { message: 'شرایط توافق‌شده الزامی است' }),
  /** ADMIN/MANAGER only — allow editing a locked contract. */
  adminOverride: z.boolean().optional(),
});

export const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1).optional(),
  opportunityId: z.string().min(1).optional(),
  amount: z.coerce.number().positive(),
  method: z.string().optional(),
  reference: z.string().optional(),
  attachmentKey: z.string().optional(),
  allowOverpayment: z.boolean().optional(),
});

export const updatePaymentSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  notes: z.string().optional().nullable(),
  allowOverpayment: z.boolean().optional(),
});

export const rejectPaymentSchema = z.object({
  rejectionReason: z
    .string()
    .trim()
    .min(3, { message: 'دلیل رد پرداخت الزامی است' })
    .max(1000),
});

function normalizeSource(source, sourceOther) {
  if (!source?.trim()) return null;
  const code = source.trim().toUpperCase();
  if (code === 'OTHER') {
    const detail = sourceOther?.trim();
    return detail ? `OTHER:${detail}` : 'OTHER';
  }
  if (LEAD_SOURCE_CODES.includes(code)) return code;
  return source.trim();
}

function sourceAuditValue(source) {
  if (!source) return null;
  if (source.startsWith('OTHER:')) {
    return { code: 'OTHER', detail: source.slice(6) };
  }
  return { code: source, label: LEAD_SOURCE_LABELS[source] || source };
}

async function assertSalesOwnerId(salesOwnerId) {
  if (!salesOwnerId) return null;
  const user = await prisma.user.findFirst({
    where: {
      id: salesOwnerId,
      deletedAt: null,
      isActive: true,
      role: { code: { in: SALES_REP_ROLE_CODES } },
    },
    select: { id: true },
  });
  if (!user) {
    throw new AppError('مسئول فروش انتخاب‌شده معتبر نیست', 400, 'INVALID_SALES_OWNER');
  }
  return salesOwnerId;
}

export const crmService = {
  async getFormOptions() {
    const salesReps = await prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        role: { code: { in: SALES_REP_ROLE_CODES } },
      },
      select: { id: true, fullName: true, role: { select: { code: true } } },
      orderBy: { fullName: 'asc' },
    });

    return {
      leadSources: LEAD_SOURCE_CODES.map((code) => ({
        code,
        label: LEAD_SOURCE_LABELS[code],
      })),
      salesReps: salesReps.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        roleCode: u.role.code,
      })),
    };
  },

  async listCustomers({
    q,
    source,
    salesOwnerId,
    page = 1,
    pageSize = 20,
  }) {
    const where = { deletedAt: null };
    if (source) {
      where.source = source === 'OTHER' ? { startsWith: 'OTHER' } : source;
    }
    if (salesOwnerId) where.salesOwnerId = salesOwnerId;
    if (q) {
      const trimmed = q.trim();
      const digits = trimmed.replace(/\D/g, '');
      const or = [
        { personName: { contains: trimmed, mode: 'insensitive' } },
        { companyName: { contains: trimmed, mode: 'insensitive' } },
        { source: { contains: trimmed, mode: 'insensitive' } },
        { salesOwner: { fullName: { contains: trimmed, mode: 'insensitive' } } },
      ];
      if (digits) {
        or.push({ normalizedWhatsapp: { contains: digits } });
        or.push({ phone: { contains: digits } });
      }
      where.OR = or;
    }
    const [items, total] = await Promise.all([
      prisma.crmCustomer.findMany({
        where,
        include: {
          salesOwner: { select: { id: true, fullName: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.crmCustomer.count({ where }),
    ]);
    return { items, total, page, pageSize };
  },
  async getCustomer(id) {
    const customer = await prisma.crmCustomer.findFirst({
      where: { id, deletedAt: null },
      include: {
        opportunities: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
        portalAccount: true,
        clientAssets: { where: { deletedAt: null } },
        projects: { where: { deletedAt: null }, select: { id: true, code: true, status: true, title: true } },
        invoices: {
          where: {
            status: { not: 'CANCELED' },
            OR: [
              { projectId: null },
              { project: { deletedAt: null } },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        payments: {
          where: {
            OR: [
              { invoiceId: null },
              {
                invoice: {
                  status: { not: 'CANCELED' },
                  OR: [
                    { projectId: null },
                    { project: { deletedAt: null } },
                  ],
                },
              },
            ],
          },
          include: {
            invoice: { select: { id: true, invoiceNumber: true } },
          },
          orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
          take: 100,
        },
        salesOwner: true,
      },
    });
    if (!customer) throw new AppError('مشتری یافت نشد', 404, 'NOT_FOUND');

    const recorderIds = [
      ...new Set(
        customer.payments
          .map((p) => p.recordedById)
          .filter(Boolean),
      ),
    ];
    const recorders = recorderIds.length
      ? await prisma.user.findMany({
          where: { id: { in: recorderIds } },
          select: { id: true, fullName: true },
        })
      : [];
    const recorderById = Object.fromEntries(recorders.map((u) => [u.id, u]));

    const payments = customer.payments.map((p) => ({
      ...p,
      recordedBy: p.recordedById ? recorderById[p.recordedById] || null : null,
    }));

    // Attach live finance snapshot per opportunity (payments = source of truth).
    const financeByOpp = await batchOpportunityFinanceSnapshots(
      prisma,
      customer.opportunities,
    );
    const opportunities = customer.opportunities.map((opp) => {
      const finance = financeByOpp.get(opp.id) || computeFinanceSnapshot(opp.agreedPrice, 0);
      return {
        ...opp,
        advancePayment: finance.totalPaid,
        finance,
      };
    });

    return {
      ...customer,
      opportunities,
      payments,
    };
  },

  async createCustomer(data, auth, req) {
    const normalized = normalizeWhatsapp(data.whatsapp);

    const existing = await prisma.crmCustomer.findUnique({ where: { normalizedWhatsapp: normalized } });
    if (existing && !existing.deletedAt) {
      throw new AppError('مشتری با این شماره واتساپ موجود است', 409, 'DUPLICATE_WHATSAPP', {
        customerId: existing.id,
      });
    }

    // Number belongs to a customer merged into another profile — point to the survivor (P-03).
    if (existing?.deletedAt && existing.notes?.startsWith('MERGED_INTO:')) {
      const survivorId = existing.notes.slice('MERGED_INTO:'.length);
      throw new AppError('این شماره قبلاً در یک پروفایل دیگر ادغام شده است', 409, 'DUPLICATE_WHATSAPP', {
        customerId: survivorId,
      });
    }

    const stage = 'NEW_LEAD';

    const normalizedSource = normalizeSource(data.source, data.sourceOther);
    const salesOwnerId = await assertSalesOwnerId(data.salesOwnerId || auth.userId);

    const customer = await prisma.$transaction(async (tx) => {
      const baseData = {
        personName: data.personName,
        companyName: data.companyName,
        jobTitle: data.jobTitle,
        phone: data.phone,
        whatsappRaw: data.whatsapp,
        normalizedWhatsapp: normalized,
        city: data.city,
        address: data.address,
        email: data.email || null,
        source: normalizedSource,
        salesOwnerId,
        pipelineStage: stage,
        portalStatus: 'NOT_ELIGIBLE',
        notes: data.notes,
        lostReason: null,
      };

      // Unique constraint covers soft-deleted rows too — restore instead of insert.
      const created = existing
        ? await tx.crmCustomer.update({
            where: { id: existing.id },
            data: { ...baseData, deletedAt: null },
          })
        : await tx.crmCustomer.create({ data: baseData });

      await tx.opportunity.create({
        data: {
          crmCustomerId: created.id,
          title: `فرصت اولیه — ${data.companyName || data.personName}`,
          pipelineStage: stage,
          serviceId: null,
          lostReason: null,
        },
      });

      await notifyManagersOnce(
        buildLeadCreatedNotification({
          customerId: created.id,
          personName: data.personName,
          phone: normalized,
        }),
        tx,
      );

      return created;
    });

    await writeAudit({
      userId: auth.userId,
      action: 'CRM_LEAD_CREATE',
      entityType: 'CrmCustomer',
      entityId: customer.id,
      after: {
        whatsapp: normalized,
        source: sourceAuditValue(customer.source),
        salesOwnerId: customer.salesOwnerId,
      },
      req,
    });

    return this.getCustomer(customer.id);
  },

  async updateCustomer(id, data, auth, req) {
    const before = await this.getCustomer(id);

    const patch = {};
    if (data.personName !== undefined) patch.personName = data.personName;
    if (data.companyName !== undefined) patch.companyName = data.companyName;
    if (data.jobTitle !== undefined) patch.jobTitle = data.jobTitle;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.city !== undefined) patch.city = data.city;
    if (data.address !== undefined) patch.address = data.address;
    if (data.email !== undefined) patch.email = data.email || null;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.nextFollowUpAt !== undefined) {
      patch.nextFollowUpAt = data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : null;
    }
    if (data.source !== undefined || data.sourceOther !== undefined) {
      patch.source = normalizeSource(
        data.source ?? before.source?.split(':')[0] ?? '',
        data.sourceOther,
      );
    }
    if (data.salesOwnerId !== undefined) {
      patch.salesOwnerId = data.salesOwnerId
        ? await assertSalesOwnerId(data.salesOwnerId)
        : null;
    }

    await prisma.crmCustomer.update({ where: { id }, data: patch });
    const updated = await this.getCustomer(id);

    await writeAudit({
      userId: auth.userId,
      action: 'CRM_CUSTOMER_UPDATE',
      entityType: 'CrmCustomer',
      entityId: id,
      before: {
        personName: before.personName,
        source: sourceAuditValue(before.source),
        salesOwnerId: before.salesOwnerId,
      },
      after: {
        personName: updated.personName,
        source: sourceAuditValue(updated.source),
        salesOwnerId: updated.salesOwnerId,
      },
      req,
    });
    return updated;
  },

  async updateOpportunityDetails(
    opportunityId,
    { agreedPrice, agreedTerms, adminOverride },
    auth,
    req,
  ) {
    const opp = await prisma.opportunity.findFirst({ where: { id: opportunityId, deletedAt: null } });
    if (!opp) throw new AppError('فرصت یافت نشد', 404, 'NOT_FOUND');

    const price = Number(agreedPrice);
    const terms = String(agreedTerms || '').trim();
    if (!(price > 0) || Number.isNaN(price)) {
      throw new AppError('قیمت مجموعی پروژه الزامی است', 400, 'VALIDATION');
    }
    if (!terms) {
      throw new AppError('شرایط توافق‌شده الزامی است', 400, 'VALIDATION');
    }

    const isAdmin = auth?.roleCode === 'ADMIN' || auth?.roleCode === 'MANAGER';
    if (opp.contractLocked) {
      if (!(adminOverride && isAdmin)) {
        throw new AppError(
          'این قرارداد قفل شده و دیگر قابل ویرایش نمی‌باشد.',
          403,
          'CONTRACT_LOCKED',
        );
      }
    }

    const before = {
      agreedPrice: opp.agreedPrice,
      advancePayment: opp.advancePayment,
      agreedTerms: opp.agreedTerms,
      contractLocked: opp.contractLocked,
    };

    const shouldConfirmOrder =
      !['COMPLETED', 'CANCELED'].includes(opp.pipelineStage);

    // advancePayment is never set manually — always derived from payment records.
    const updated = await prisma.$transaction(async (tx) => {
      await tx.opportunity.update({
        where: { id: opportunityId },
        data: {
          agreedPrice: price,
          agreedTerms: terms,
          contractLocked: true,
          contractLockedAt: opp.contractLockedAt || new Date(),
          contractLockedById: opp.contractLockedById || auth.userId,
          ...(shouldConfirmOrder && { pipelineStage: 'ORDER_CONFIRMED', lostReason: null }),
        },
      });
      if (shouldConfirmOrder) {
        await tx.crmCustomer.update({
          where: { id: opp.crmCustomerId },
          data: { pipelineStage: 'ORDER_CONFIRMED', lostReason: null },
        });
      }
      const { opportunity, finance } = await syncOpportunityFinance(tx, opportunityId, {
        persist: true,
      });
      const locked = await tx.opportunity.findUnique({
        where: { id: opportunityId },
        select: {
          contractLocked: true,
          contractLockedAt: true,
          contractLockedById: true,
          agreedPrice: true,
          agreedTerms: true,
          advancePayment: true,
        },
      });
      return { ...opportunity, ...locked, finance };
    });

    await writeAudit({
      userId: auth.userId,
      action: 'OPPORTUNITY_DETAILS_UPDATE',
      entityType: 'Opportunity',
      entityId: opportunityId,
      before,
      after: {
        agreedPrice: updated.agreedPrice,
        advancePayment: updated.finance.totalPaid,
        agreedTerms: updated.agreedTerms,
        contractLocked: updated.contractLocked,
        finance: updated.finance,
        adminOverride: !!(adminOverride && isAdmin),
      },
      req,
    });
    return updated;
  },

  /** ADMIN/MANAGER — unlock contract price & terms for authorized correction. */
  async unlockContractDetails(opportunityId, auth, req) {
    if (auth?.roleCode !== 'ADMIN' && auth?.roleCode !== 'MANAGER') {
      throw new AppError('فقط مدیر مجاز به بازکردن قفل قرارداد است', 403, 'FORBIDDEN');
    }
    const opp = await prisma.opportunity.findFirst({ where: { id: opportunityId, deletedAt: null } });
    if (!opp) throw new AppError('فرصت یافت نشد', 404, 'NOT_FOUND');
    if (!opp.contractLocked) {
      return {
        id: opp.id,
        contractLocked: false,
        agreedPrice: opp.agreedPrice,
        agreedTerms: opp.agreedTerms,
      };
    }

    const updated = await prisma.opportunity.update({
      where: { id: opportunityId },
      data: {
        contractLocked: false,
        contractLockedAt: null,
        contractLockedById: null,
      },
      select: {
        id: true,
        contractLocked: true,
        agreedPrice: true,
        agreedTerms: true,
      },
    });

    await writeAudit({
      userId: auth.userId,
      action: 'OPPORTUNITY_CONTRACT_UNLOCK',
      entityType: 'Opportunity',
      entityId: opportunityId,
      before: { contractLocked: true },
      after: { contractLocked: false },
      req,
    });

    return updated;
  },

  async createDepositInvoice(opportunityId, { amount, dueAt, notes }, auth, req) {
    const opp = await prisma.opportunity.findFirst({
      where: { id: opportunityId, deletedAt: null },
      include: { crmCustomer: true },
    });
    if (!opp) throw new AppError('فرصت یافت نشد', 404, 'NOT_FOUND');
    if (opp.agreedPrice == null || Number(opp.agreedPrice) <= 0) {
      throw new AppError('ابتدا قیمت مجموعی پروژه را ثبت کنید', 400, 'AGREED_PRICE_REQUIRED');
    }
    if (!opp.agreedTerms?.trim()) {
      throw new AppError('ابتدا شرایط توافق‌شده را ثبت کنید', 400, 'AGREED_TERMS_REQUIRED');
    }

    const count = await prisma.invoice.count();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
    const total = Number(amount);

    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          invoiceNumber,
          crmCustomerId: opp.crmCustomerId,
          opportunityId: opp.id,
          status: 'ISSUED',
          issuedAt: new Date(),
          dueAt: dueAt ? new Date(dueAt) : null,
          subtotal: total,
          total,
          notes: notes || 'فاکتور بیعانه',
          items: {
            create: [{ description: 'بیعانه پروژه', quantity: 1, unitPrice: total, amount: total }],
          },
        },
        include: { items: true },
      });
      return inv;
    });

    await writeAudit({
      userId: auth.userId,
      action: 'DEPOSIT_INVOICE_CREATE',
      entityType: 'Invoice',
      entityId: invoice.id,
      after: { total, opportunityId },
      req,
    });
    return invoice;
  },

  async recordPayment(
    { invoiceId, opportunityId, amount, method, reference, attachmentKey, allowOverpayment },
    auth,
    req,
  ) {
    const amt = Number(amount);
    if (!(amt > 0) || Number.isNaN(amt)) {
      throw new AppError('مبلغ باید عدد مثبت باشد', 400, 'VALIDATION');
    }

    let crmCustomerId;
    let resolvedInvoiceId = invoiceId || null;
    let resolvedOpportunityId = opportunityId || null;
    let agreedPrice = 0;

    if (invoiceId) {
      const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) throw new AppError('فاکتور یافت نشد', 404, 'NOT_FOUND');
      crmCustomerId = invoice.crmCustomerId;
      if (!resolvedOpportunityId && invoice.opportunityId) {
        resolvedOpportunityId = invoice.opportunityId;
      }
    } else if (opportunityId) {
      const opp = await prisma.opportunity.findFirst({
        where: { id: opportunityId, deletedAt: null },
      });
      if (!opp) throw new AppError('فرصت یافت نشد', 404, 'NOT_FOUND');
      crmCustomerId = opp.crmCustomerId;
      agreedPrice = Number(opp.agreedPrice || 0);
    } else {
      throw new AppError('فاکتور یا فرصت الزامی است', 400, 'VALIDATION');
    }

    if (resolvedOpportunityId) {
      const available = await getAvailableRemaining(prisma, {
        opportunityId: resolvedOpportunityId,
        crmCustomerId,
      });
      agreedPrice = available.projectTotal;
      if (available.projectTotal <= 0) {
        throw new AppError(
          'ابتدا قیمت مجموعی پروژه را ثبت کنید',
          400,
          'AGREED_PRICE_REQUIRED',
        );
      }
      assertPaymentWithinRemaining({
        amount: amt,
        remainingBalance: available.remainingBalance,
        allowOverpayment: !!allowOverpayment,
        auth,
      });
    }

    const priorPaymentCount = await prisma.payment.count({
      where: { crmCustomerId },
    });
    const isFirstPayment = priorPaymentCount === 0;

    const year = new Date().getFullYear();
    const seq = priorPaymentCount + 1;
    const paymentNumber = reference?.trim()
      || `PAY-${year}-${String(seq).padStart(5, '0')}`;
    const paidAt = new Date();
    const autoApprove = shouldAutoApprovePayment(auth);
    const initialVerification = autoApprove ? 'VERIFIED' : 'PENDING';

    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          crmCustomerId,
          invoiceId: resolvedInvoiceId,
          amount: amt,
          paidAt,
          method: method || 'BANK_TRANSFER',
          reference: paymentNumber,
          attachmentKey,
          verification: initialVerification,
          ...(autoApprove
            ? { verifiedAt: paidAt, verifiedById: auth.userId }
            : {}),
          recordedById: auth.userId,
        },
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              opportunityId: true,
              projectId: true,
            },
          },
          crmCustomer: {
            select: { id: true, personName: true, companyName: true },
          },
        },
      });

      const recordedBy = await tx.user.findUnique({
        where: { id: auth.userId },
        select: { id: true, fullName: true },
      });

      // Only approved payments affect finance. Pending creates leave totals unchanged.
      let finance = computeFinanceSnapshot(agreedPrice, 0);
      if (resolvedOpportunityId) {
        const synced = await syncOpportunityFinance(tx, resolvedOpportunityId, {
          persist: true,
        });
        finance = synced.finance;
      } else {
        await syncCustomerOpportunitiesFinance(tx, crmCustomerId);
      }

      if (autoApprove && resolvedInvoiceId) {
        const invoice = await tx.invoice.findUnique({ where: { id: resolvedInvoiceId } });
        if (invoice) {
          const verifiedSum = await tx.payment.aggregate({
            where: { invoiceId: resolvedInvoiceId, verification: 'VERIFIED' },
            _sum: { amount: true },
          });
          const received = Number(verifiedSum._sum.amount || 0);
          const total = Number(invoice.total);
          let status = 'ISSUED';
          if (received <= 0) status = 'ISSUED';
          else if (received < total) status = 'PARTIALLY_PAID';
          else status = 'PAID';
          await tx.invoice.update({
            where: { id: resolvedInvoiceId },
            data: { status },
          });
        }
      }

      if (isFirstPayment) {
        if (resolvedOpportunityId) {
          await tx.opportunity.updateMany({
            where: {
              id: resolvedOpportunityId,
              deletedAt: null,
              pipelineStage: { notIn: ['COMPLETED', 'CANCELED'] },
            },
            data: { pipelineStage: 'ORDER_CONFIRMED', lostReason: null },
          });
        }
        await tx.crmCustomer.updateMany({
          where: {
            id: crmCustomerId,
            deletedAt: null,
            pipelineStage: { notIn: ['COMPLETED', 'CANCELED'] },
          },
          data: { pipelineStage: 'ORDER_CONFIRMED', lostReason: null },
        });
      }

      if (!autoApprove) {
        const ctx = await resolvePaymentContext(tx, created);
        await notifyManagersOnce(
          buildPaymentPendingApprovalNotification({
            paymentId: created.id,
            amount: amt,
            creatorName: recordedBy?.fullName,
            customerName: ctx.customerName,
            projectTitle: ctx.projectTitle,
            projectId: ctx.projectId,
            crmCustomerId,
            createdAt: paidAt,
          }),
          tx,
        );
      }

      return { ...created, recordedBy, finance };
    });

    await writeAudit({
      userId: auth.userId,
      action: 'PAYMENT_RECORD',
      entityType: 'Payment',
      entityId: payment.id,
      after: {
        amount: amt,
        invoiceId: resolvedInvoiceId,
        opportunityId: resolvedOpportunityId || null,
        paymentNumber,
        paidAt,
        verification: initialVerification,
        awaitingApproval: !autoApprove,
        isFirstPayment,
        portalInviteUnlocked: isFirstPayment,
        receiptGenerated: true,
        finance: payment.finance,
      },
      req,
    });

    return {
      ...payment,
      paymentNumber,
      isFirstPayment,
      portalInviteUnlocked: isFirstPayment,
      receiptGenerated: true,
      awaitingApproval: !autoApprove,
      approvalStatus: autoApprove ? 'APPROVED' : 'PENDING_APPROVAL',
      finance: payment.finance,
    };
  },

  /**
   * Update payment amount / notes and recalculate contract finance.
   */
  async updatePayment(paymentId, { amount, notes, allowOverpayment }, auth, req) {
    const existing = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { invoice: { select: { opportunityId: true } } },
    });
    if (!existing) throw new AppError('پرداخت یافت نشد', 404, 'NOT_FOUND');
    if (existing.verification === 'REJECTED') {
      throw new AppError('پرداخت رد‌شده قابل ویرایش نیست', 400, 'PAYMENT_REJECTED');
    }

    const nextAmount = amount !== undefined ? Number(amount) : Number(existing.amount);
    if (!(nextAmount > 0) || Number.isNaN(nextAmount)) {
      throw new AppError('مبلغ باید عدد مثبت باشد', 400, 'VALIDATION');
    }

    const opportunityId = existing.invoice?.opportunityId
      || (await prisma.opportunity.findFirst({
        where: { crmCustomerId: existing.crmCustomerId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      }))?.id;

    if (opportunityId && existing.verification !== 'REJECTED') {
      const available = await getAvailableRemaining(prisma, {
        opportunityId,
        crmCustomerId: existing.crmCustomerId,
        excludePaymentId: paymentId,
      });
      assertPaymentWithinRemaining({
        amount: nextAmount,
        remainingBalance: available.remainingBalance,
        allowOverpayment: !!allowOverpayment,
        auth,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          ...(amount !== undefined && { amount: nextAmount }),
          ...(notes !== undefined && { notes }),
        },
      });

      let finance = null;
      if (opportunityId) {
        finance = (await syncOpportunityFinance(tx, opportunityId, { persist: true })).finance;
      } else {
        await syncCustomerOpportunitiesFinance(tx, existing.crmCustomerId);
      }
      return { payment: updated, finance };
    });

    await writeAudit({
      userId: auth.userId,
      action: 'PAYMENT_UPDATE',
      entityType: 'Payment',
      entityId: paymentId,
      before: { amount: Number(existing.amount) },
      after: { amount: nextAmount, finance: result.finance },
      req,
    });

    return { ...result.payment, finance: result.finance };
  },

  /**
   * Delete a payment and recalculate contract finance.
   */
  async deletePayment(paymentId, auth, req) {
    const existing = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { invoice: { select: { opportunityId: true } } },
    });
    if (!existing) throw new AppError('پرداخت یافت نشد', 404, 'NOT_FOUND');

    const opportunityId = existing.invoice?.opportunityId || null;

    const result = await prisma.$transaction(async (tx) => {
      await tx.payment.delete({ where: { id: paymentId } });
      let finance = null;
      if (opportunityId) {
        finance = (await syncOpportunityFinance(tx, opportunityId, { persist: true })).finance;
      } else {
        const synced = await syncCustomerOpportunitiesFinance(tx, existing.crmCustomerId);
        finance = synced[0]?.finance || null;
      }
      return finance;
    });

    await writeAudit({
      userId: auth.userId,
      action: 'PAYMENT_DELETE',
      entityType: 'Payment',
      entityId: paymentId,
      before: {
        amount: Number(existing.amount),
        verification: existing.verification,
      },
      after: { deleted: true, finance: result },
      req,
    });

    return { deleted: true, id: paymentId, finance: result };
  },

  /**
   * Reject a pending payment (excluded from finance) and notify the creator.
   * Manager/Admin only.
   */
  async rejectPayment(paymentId, { rejectionReason } = {}, auth, req) {
    assertPaymentApprover(auth);

    const reason = String(rejectionReason || '').trim();
    if (reason.length < 3) {
      throw new AppError('دلیل رد پرداخت الزامی است', 400, 'VALIDATION');
    }

    const existing = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: { select: { opportunityId: true, projectId: true } },
        crmCustomer: { select: { id: true, personName: true, companyName: true } },
      },
    });
    if (!existing) throw new AppError('پرداخت یافت نشد', 404, 'NOT_FOUND');
    if (existing.verification === 'REJECTED') {
      return { ...existing, finance: null, approvalStatus: 'REJECTED' };
    }
    if (existing.verification === 'VERIFIED') {
      throw new AppError(
        'پرداخت تأییدشده قابل رد نیست. ابتدا وضعیت مالی را بررسی کنید.',
        400,
        'PAYMENT_ALREADY_APPROVED',
      );
    }

    const opportunityId = existing.invoice?.opportunityId || null;
    const rejectedAt = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.update({
        where: { id: paymentId },
        data: {
          verification: 'REJECTED',
          rejectedAt,
          rejectedById: auth.userId,
          rejectionReason: reason,
          verifiedAt: null,
          verifiedById: null,
        },
      });

      // Pending never entered finance; sync keeps caches consistent.
      let finance = null;
      if (opportunityId) {
        finance = (await syncOpportunityFinance(tx, opportunityId, { persist: true })).finance;
      } else {
        const synced = await syncCustomerOpportunitiesFinance(tx, existing.crmCustomerId);
        finance = synced[0]?.finance || null;
      }

      if (existing.recordedById && existing.recordedById !== auth.userId) {
        const ctx = await resolvePaymentContext(tx, existing);
        await createNotificationOnce(
          {
            userId: existing.recordedById,
            audience: 'INTERNAL',
            ...buildPaymentRejectedNotification({
              paymentId,
              amount: existing.amount,
              projectTitle: ctx.projectTitle,
              projectId: ctx.projectId,
              crmCustomerId: existing.crmCustomerId,
              rejectionReason: reason,
              rejectedAt,
            }),
          },
          tx,
        );
      }

      return { payment: p, finance };
    });

    await writeAudit({
      userId: auth.userId,
      action: 'PAYMENT_REJECT',
      entityType: 'Payment',
      entityId: paymentId,
      after: {
        verification: 'REJECTED',
        rejectionReason: reason,
        finance: result.finance,
      },
      req,
    });

    return {
      ...result.payment,
      finance: result.finance,
      approvalStatus: 'REJECTED',
    };
  },

  /** Structured receipt payload for a recorded payment. */
  async getPaymentReceipt(paymentId) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: { select: { id: true, invoiceNumber: true, total: true } },
        crmCustomer: {
          select: {
            id: true,
            personName: true,
            companyName: true,
            phone: true,
            whatsappRaw: true,
            email: true,
            city: true,
            address: true,
            opportunities: {
              where: { deletedAt: null },
              orderBy: { updatedAt: 'desc' },
              take: 1,
              select: {
                id: true,
                title: true,
                agreedPrice: true,
                advancePayment: true,
                agreedTerms: true,
              },
            },
          },
        },
      },
    });
    if (!payment) throw new AppError('پرداخت یافت نشد', 404, 'NOT_FOUND');

    const recordedBy = payment.recordedById
      ? await prisma.user.findUnique({
          where: { id: payment.recordedById },
          select: { id: true, fullName: true },
        })
      : null;

    const opportunity = payment.crmCustomer.opportunities[0] || null;
    let projectTotal = opportunity ? Number(opportunity.agreedPrice || 0) : 0;
    let paidTotal = Number(opportunity?.advancePayment || 0);
    if (opportunity) {
      const { finance } = await syncOpportunityFinance(prisma, opportunity.id, {
        persist: false,
      });
      projectTotal = finance.projectTotal;
      paidTotal = finance.totalPaid;
    }
    const remaining = Math.max(0, projectTotal - paidTotal);
    const paymentNumber = payment.reference || `PAY-${payment.id.slice(-8).toUpperCase()}`;

    return {
      receiptTitle: 'رسید پرداخت',
      company: {
        name: 'اپیکس',
        tagline: 'سیستم مدیریت مشتریان و پروژه‌ها',
      },
      customer: {
        id: payment.crmCustomer.id,
        personName: payment.crmCustomer.personName,
        companyName: payment.crmCustomer.companyName,
        phone: payment.crmCustomer.phone || payment.crmCustomer.whatsappRaw,
        email: payment.crmCustomer.email,
        city: payment.crmCustomer.city,
        address: payment.crmCustomer.address,
      },
      contract: opportunity
        ? {
            title: opportunity.title,
            agreedPrice: projectTotal,
            advancePayment: paidTotal,
            remainingBalance: remaining,
            agreedTerms: opportunity.agreedTerms,
          }
        : null,
      payment: {
        id: payment.id,
        paymentNumber,
        amount: Number(payment.amount),
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
        method: payment.method,
        verification: payment.verification,
        invoiceNumber: payment.invoice?.invoiceNumber || null,
        recordedByName: recordedBy?.fullName || null,
      },
      generatedAt: new Date().toISOString(),
    };
  },

  /** Printable HTML receipt (print / Save as PDF). */
  async getPaymentReceiptHtml(paymentId) {
    const receipt = await this.getPaymentReceipt(paymentId);
    return buildPaymentReceiptHtml(receipt);
  },

  /**
   * Approve a pending payment — includes it in all financial calculations.
   * Manager/Admin only.
   */
  async verifyPayment(paymentId, auth, req) {
    assertPaymentApprover(auth);

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: true,
        crmCustomer: { select: { id: true, personName: true, companyName: true } },
      },
    });
    if (!payment) throw new AppError('پرداخت یافت نشد', 404, 'NOT_FOUND');
    if (payment.verification === 'VERIFIED') {
      return { ...payment, approvalStatus: 'APPROVED' };
    }
    if (payment.verification === 'REJECTED') {
      throw new AppError('پرداخت رد‌شده قابل تأیید نیست', 400, 'PAYMENT_REJECTED');
    }

    const approvedAt = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.update({
        where: { id: paymentId },
        data: {
          verification: 'VERIFIED',
          verifiedAt: approvedAt,
          verifiedById: auth.userId,
          rejectedAt: null,
          rejectedById: null,
          rejectionReason: null,
        },
      });

      if (payment.invoiceId) {
        const verifiedSum = await tx.payment.aggregate({
          where: { invoiceId: payment.invoiceId, verification: 'VERIFIED' },
          _sum: { amount: true },
        });
        const received = Number(verifiedSum._sum.amount || 0);
        const total = Number(payment.invoice.total);
        let status = 'ISSUED';
        if (received <= 0) status = 'ISSUED';
        else if (received < total) status = 'PARTIALLY_PAID';
        else status = 'PAID';

        await tx.invoice.update({
          where: { id: payment.invoiceId },
          data: { status },
        });
      }

      let finance = null;
      if (payment.invoice?.opportunityId) {
        finance = (await syncOpportunityFinance(tx, payment.invoice.opportunityId, {
          persist: true,
        })).finance;
      } else if (payment.invoice?.projectId) {
        finance = (await syncProjectFinanceFromPayments(tx, payment.invoice.projectId, {
          persist: true,
        }))?.finance || null;
      } else {
        const synced = await syncCustomerOpportunitiesFinance(tx, payment.crmCustomerId);
        finance = synced[0]?.finance || null;
      }

      if (payment.recordedById && payment.recordedById !== auth.userId) {
        const ctx = await resolvePaymentContext(tx, payment);
        await createNotificationOnce(
          {
            userId: payment.recordedById,
            audience: 'INTERNAL',
            ...buildPaymentApprovedNotification({
              paymentId,
              amount: payment.amount,
              projectTitle: ctx.projectTitle,
              projectId: ctx.projectId,
              crmCustomerId: payment.crmCustomerId,
              approvedAt,
            }),
          },
          tx,
        );
      }

      return { payment: p, finance };
    });

    await writeAudit({
      userId: auth.userId,
      action: 'PAYMENT_VERIFY',
      entityType: 'Payment',
      entityId: paymentId,
      after: { verification: 'VERIFIED', finance: result.finance },
      req,
    });

    return {
      ...result.payment,
      finance: result.finance,
      approvalStatus: 'APPROVED',
    };
  },

  /** Portal invite unlocks after the customer has at least one recorded payment. */
  async getInviteEligibility(opportunityId) {
    const opp = await prisma.opportunity.findFirst({
      where: { id: opportunityId, deletedAt: null },
      include: {
        crmCustomer: { include: { portalAccount: true } },
      },
    });
    if (!opp) throw new AppError('فرصت یافت نشد', 404, 'NOT_FOUND');

    const phoneOk = !!(opp.crmCustomer.phone?.trim() || opp.crmCustomer.normalizedWhatsapp);

    const paymentCount = await prisma.payment.count({
      where: { crmCustomerId: opp.crmCustomerId },
    });
    const hasFirstPayment = paymentCount > 0;

    const eligible = phoneOk && hasFirstPayment;

    return {
      eligible,
      opportunityId: opp.id,
      crmCustomerId: opp.crmCustomerId,
      hasExistingPortal: !!opp.crmCustomer.portalAccount,
      gates: {
        hasPhone: phoneOk,
        hasFirstPayment,
      },
    };
  },

  async createPortalInvite(opportunityId, auth, req) {
    const eligibility = await this.getInviteEligibility(opportunityId);
    if (!eligibility.eligible) {
      let message = 'دعوت پورتال پس از ثبت اولین پرداخت مشتری فعال می‌شود';
      if (eligibility.gates?.hasFirstPayment && !eligibility.gates?.hasPhone) {
        message = 'برای دعوت پورتال، شماره تماس مشتری الزامی است';
      } else if (!eligibility.gates?.hasFirstPayment) {
        message = 'دعوت پورتال پس از ثبت اولین پرداخت مشتری فعال می‌شود';
      }
      throw new AppError(
        message,
        403,
        'INVITE_NOT_ELIGIBLE',
        { gates: eligibility.gates },
      );
    }

    const opp = await prisma.opportunity.findFirst({
      where: { id: opportunityId, deletedAt: null },
      include: {
        crmCustomer: { include: { portalAccount: true } },
      },
    });
    if (!opp) throw new AppError('فرصت یافت نشد', 404, 'NOT_FOUND');

    const token = randomToken(24);
    const invite = await prisma.$transaction(async (tx) => {
      await tx.portalInvite.updateMany({
        where: { opportunityId, usedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      const inv = await tx.portalInvite.create({
        data: {
          crmCustomerId: opp.crmCustomerId,
          opportunityId: opp.id,
          portalAccountId: opp.crmCustomer.portalAccount?.id || null,
          whatsappNumber: opp.crmCustomer.normalizedWhatsapp,
          token,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await tx.crmCustomer.update({
        where: { id: opp.crmCustomerId },
        data: { portalStatus: 'INVITED' },
      });

      return inv;
    });

    await writeAudit({
      userId: auth.userId,
      action: 'PORTAL_INVITE_CREATE',
      entityType: 'PortalInvite',
      entityId: invite.id,
      after: { opportunityId, expiresAt: invite.expiresAt },
      req,
    });

    return {
      ...invite,
      registerUrl: `${process.env.WEB_URL || 'http://localhost:3000'}/portal/register/${invite.token}`,
    };
  },

  async updateOpportunity(opportunityId, data, auth, req) {
    const opp = await prisma.opportunity.findFirst({ where: { id: opportunityId, deletedAt: null } });
    if (!opp) throw new AppError('فرصت یافت نشد', 404, 'NOT_FOUND');

    const updated = await prisma.opportunity.update({
      where: { id: opportunityId },
      data: {
        title: data.title ?? undefined,
        proposedPrice: data.proposedPrice != null ? Number(data.proposedPrice) : undefined,
        agreedPrice: data.agreedPrice != null ? Number(data.agreedPrice) : undefined,
        agreedTerms: data.agreedTerms ?? undefined,
        serviceId: data.serviceId ?? undefined,
      },
    });

    await writeAudit({
      userId: auth.userId,
      action: 'OPPORTUNITY_UPDATE',
      entityType: 'Opportunity',
      entityId: opportunityId,
      before: { agreedPrice: opp.agreedPrice, agreedTerms: opp.agreedTerms },
      after: { agreedPrice: updated.agreedPrice, agreedTerms: updated.agreedTerms },
      req,
    });
    return updated;
  },

  async createClientAsset(customerId, { kind, name, storageKey, mimeType, sizeBytes, meta }, auth, req) {
    await this.getCustomer(customerId);
    if (!storageKey || !name) throw new AppError('نام و مسیر فایل الزامی است', 400, 'VALIDATION');

    const asset = await prisma.clientAsset.create({
      data: {
        crmCustomerId: customerId,
        kind: kind || 'OTHER',
        name,
        storageKey,
        mimeType: mimeType || null,
        sizeBytes: sizeBytes != null ? Number(sizeBytes) : null,
        meta: meta || undefined,
      },
    });

    await writeAudit({
      userId: auth.userId,
      action: 'CLIENT_ASSET_CREATE',
      entityType: 'ClientAsset',
      entityId: asset.id,
      after: { kind: asset.kind, name: asset.name },
      req,
    });
    return asset;
  },

  async softDeleteCustomer(id, auth, req) {
    const customer = await this.getCustomer(id);
    const liveProjects = customer.projects || [];

    if (liveProjects.length && auth.roleCode !== 'MANAGER' && auth.roleCode !== 'ADMIN') {
      throw new AppError(
        'حذف مشتری دارای پروژه فقط توسط مدیر مجاز است',
        403,
        'FORBIDDEN',
      );
    }

    const deletedAt = new Date();
    const tombstone = (value) => `deleted:${id}:${value}`.slice(0, 190);

    const result = await prisma.$transaction(async (tx) => {
      const portal = await tx.portalAccount.findFirst({
        where: { crmCustomerId: id },
      });

      // ── Portal access: revoke sessions, OTPs, invites, notifications ──
      if (portal) {
        await tx.session.deleteMany({ where: { portalAccountId: portal.id } });
        await tx.otpCode.deleteMany({ where: { portalAccountId: portal.id } });
        await tx.notification.deleteMany({ where: { portalAccountId: portal.id } });
      }

      const invites = await tx.portalInvite.findMany({
        where: { crmCustomerId: id },
        select: { id: true },
      });
      const inviteIds = invites.map((i) => i.id);
      if (inviteIds.length) {
        await tx.otpCode.deleteMany({ where: { portalInviteId: { in: inviteIds } } });
        await tx.portalInvite.deleteMany({ where: { id: { in: inviteIds } } });
      }

      // Internal notifications pointing at this customer
      await tx.notification.deleteMany({
        where: {
          OR: [
            { link: `/crm/${id}` },
            { link: { startsWith: `/crm/${id}?` } },
            { link: { startsWith: `/crm/${id}/` } },
            { meta: { path: ['customerId'], equals: id } },
          ],
        },
      });

      // ── Projects: purge finance + soft-delete (all projects for this customer) ──
      const projects = await tx.project.findMany({
        where: { crmCustomerId: id },
        include: {
          invoices: { select: { id: true } },
          opportunity: { select: { id: true } },
        },
      });
      const projectIds = projects.map((p) => p.id);
      const projectInvoiceIds = projects.flatMap((p) => p.invoices.map((inv) => inv.id));

      if (projectInvoiceIds.length) {
        await tx.payment.deleteMany({ where: { invoiceId: { in: projectInvoiceIds } } });
        await tx.invoice.deleteMany({ where: { id: { in: projectInvoiceIds } } });
      }

      if (projectIds.length) {
        await tx.expense.deleteMany({ where: { projectId: { in: projectIds } } });
        await tx.employeePayable.deleteMany({ where: { projectId: { in: projectIds } } });

        // Detach opportunities before soft-deleting projects
        for (const project of projects) {
          if (project.opportunity) {
            await tx.opportunity.update({
              where: { id: project.opportunity.id },
              data: { projectId: null },
            });
          }
        }

        await tx.project.updateMany({
          where: { id: { in: projectIds } },
          data: { deletedAt, portalAccountId: null },
        });
      }

      // ── Remaining customer finance (e.g. deposit invoices without project) ──
      const remainingInvoices = await tx.invoice.findMany({
        where: { crmCustomerId: id },
        select: { id: true },
      });
      const remainingInvoiceIds = remainingInvoices.map((inv) => inv.id);
      let paymentsRemoved = 0;
      let invoicesRemoved = projectInvoiceIds.length;

      if (remainingInvoiceIds.length) {
        paymentsRemoved += (
          await tx.payment.deleteMany({ where: { invoiceId: { in: remainingInvoiceIds } } })
        ).count;
        invoicesRemoved += (
          await tx.invoice.deleteMany({ where: { id: { in: remainingInvoiceIds } } })
        ).count;
      }
      paymentsRemoved += (
        await tx.payment.deleteMany({ where: { crmCustomerId: id } })
      ).count;

      // ── Opportunities & client assets ──
      const opportunitiesDeleted = (
        await tx.opportunity.updateMany({
          where: { crmCustomerId: id, deletedAt: null },
          data: { deletedAt },
        })
      ).count;

      const assetsDeleted = (
        await tx.clientAsset.updateMany({
          where: { crmCustomerId: id, deletedAt: null },
          data: { deletedAt },
        })
      ).count;

      // ── Portal account ──
      let portalDeleted = false;
      if (portal) {
        await tx.portalAccount.update({
          where: { id: portal.id },
          data: {
            deletedAt,
            isActive: false,
            passwordHash: null,
            normalizedWhatsapp: tombstone(portal.normalizedWhatsapp),
          },
        });
        portalDeleted = true;
      }

      // ── Customer record ──
      const updated = await tx.crmCustomer.update({
        where: { id },
        data: {
          deletedAt,
          portalStatus: 'SUSPENDED',
          pipelineStage: 'CANCELED',
          lostReason: 'حذف شده از سیستم',
          normalizedWhatsapp: tombstone(customer.normalizedWhatsapp),
          nextFollowUpAt: null,
        },
      });

      return {
        updated,
        cleaned: {
          projects: projectIds.length,
          invites: inviteIds.length,
          opportunities: opportunitiesDeleted,
          assets: assetsDeleted,
          payments: paymentsRemoved,
          invoices: invoicesRemoved,
          portalAccount: portalDeleted,
        },
      };
    });

    await writeAudit({
      userId: auth.userId,
      action: 'CRM_CUSTOMER_PURGE',
      entityType: 'CrmCustomer',
      entityId: id,
      before: {
        personName: customer.personName,
        companyName: customer.companyName,
        portalStatus: customer.portalStatus,
        projectCount: liveProjects.length,
      },
      after: { deletedAt, cleaned: result.cleaned },
      req,
    });

    return {
      id: result.updated.id,
      deletedAt: result.updated.deletedAt,
      cleaned: result.cleaned,
    };
  },

  /**
   * Spec §5.4 — Merge Duplicate: manager/senior sales only; keep projects & timeline on survivor.
   */
  async mergeDuplicates({ survivorId, duplicateId }, auth, req) {
    if (survivorId === duplicateId) throw new AppError('شناسه‌ها یکسان هستند', 400, 'VALIDATION');
    const [survivor, duplicate] = await Promise.all([
      prisma.crmCustomer.findFirst({ where: { id: survivorId, deletedAt: null } }),
      prisma.crmCustomer.findFirst({
        where: { id: duplicateId, deletedAt: null },
        include: { portalAccount: true },
      }),
    ]);
    if (!survivor || !duplicate) throw new AppError('مشتری یافت نشد', 404, 'NOT_FOUND');

    const survivorPortal = await prisma.portalAccount.findFirst({
      where: { crmCustomerId: survivorId, deletedAt: null },
    });
    if (duplicate.portalAccount && survivorPortal) {
      throw new AppError('هر دو مشتری حساب پورتال دارند؛ ادغام دستی نیاز است', 409, 'PORTAL_CONFLICT');
    }

    await prisma.$transaction(async (tx) => {
      await tx.opportunity.updateMany({ where: { crmCustomerId: duplicateId }, data: { crmCustomerId: survivorId } });
      await tx.clientAsset.updateMany({ where: { crmCustomerId: duplicateId }, data: { crmCustomerId: survivorId } });
      await tx.project.updateMany({ where: { crmCustomerId: duplicateId }, data: { crmCustomerId: survivorId } });
      await tx.invoice.updateMany({ where: { crmCustomerId: duplicateId }, data: { crmCustomerId: survivorId } });
      await tx.payment.updateMany({ where: { crmCustomerId: duplicateId }, data: { crmCustomerId: survivorId } });
      await tx.portalInvite.updateMany({ where: { crmCustomerId: duplicateId }, data: { crmCustomerId: survivorId } });

      if (duplicate.portalAccount && !survivorPortal) {
        await tx.portalAccount.update({
          where: { id: duplicate.portalAccount.id },
          data: { crmCustomerId: survivorId },
        });
      }

      await tx.crmCustomer.update({
        where: { id: duplicateId },
        data: { deletedAt: new Date(), notes: `MERGED_INTO:${survivorId}` },
      });
    });

    await writeAudit({
      userId: auth.userId,
      action: 'CRM_MERGE_DUPLICATE',
      entityType: 'CrmCustomer',
      entityId: survivorId,
      before: { duplicateId },
      after: { survivorId },
      req,
    });

    return this.getCustomer(survivorId);
  },

  checkDuplicate(whatsapp) {
    const normalized = normalizeWhatsapp(whatsapp);
    return prisma.crmCustomer.findFirst({
      where: { normalizedWhatsapp: normalized, deletedAt: null },
      select: { id: true, personName: true, companyName: true },
    }).then((found) => ({ normalized, exists: !!found, customer: found }));
  },
};
