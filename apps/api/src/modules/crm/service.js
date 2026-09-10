import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/response.js";
import { getCustomerPersonName } from "../../utils/crmCustomerName.js";
import {
  normalizeWhatsapp,
  parseInternationalPhone,
  getWhatsappLookupKeys,
  whatsappNumbersMatch,
} from "../../utils/whatsappNormalize.js";
import { writeAudit } from "../../middleware/audit.js";
import { randomToken } from "../../utils/tokens.js";
import {
  notifyManagersOnce,
  buildLeadCreatedNotification,
  buildCustomerConvertedNotification,
  createNotificationOnce,
} from "../../services/notifications.js";
import {
  LEAD_SOURCE_CODES,
  LEAD_SOURCE_LABELS,
  SALES_REP_ROLE_CODES,
} from "./constants.js";
import { buildPaymentReceiptHtml } from "./paymentReceiptHtml.js";
import {
  buildInvoiceDocumentHtml,
  invoiceStatusLabel,
} from "./invoiceDocumentHtml.js";
import {
  allocateCustomerCode,
  normalizeCustomerCodeQuery,
} from "./customerCode.js";
import {
  applyCrmEvent,
  maybeAutoConvertAfterFirstVerifiedPayment,
} from "./sync.js";
import {
  openFreshCycleOpportunity,
  snapshotCustomerProfile,
} from "./repeatCycle.js";
import { listCrmActivities, recordCrmActivity } from "./activity.js";
import {
  ACTIVITY_TYPES,
  CRM_EVENTS,
  CRM_STAGES,
  canManuallySetStage,
  canonicalizeStage,
  pipelineCatalog,
  buildCategoryWhere,
  isClosedStage,
} from "./pipeline.js";
import { serializeListItem, withCrmView } from "./serialize.js";
import { serializePortalCredentials } from "./portalInvites.js";
import { customerListScopeCondition } from "./visibility.js";
import {
  assertSalesCustomerAccess,
  assertSalesCustomerListOwnerFilter,
  salesCustomerListFilter,
} from "./salesAccess.js";
import { ingestWhatsAppMessage } from "./ingestion.js";
import {
  assertPaymentWithinRemaining,
  batchOpportunityFinanceSnapshots,
  computeFinanceSnapshot,
  getAvailableRemaining,
  roundMoney,
  syncCustomerOpportunitiesFinance,
  syncOpportunityFinance,
  syncProjectFinanceFromPayments,
} from "./paymentFinance.js";
import {
  assertPaymentApprover,
  buildPaymentApprovedNotification,
  buildPaymentPendingApprovalNotification,
  buildPaymentRejectedNotification,
  resolvePaymentContext,
  shouldAutoApprovePayment,
} from "./paymentApproval.js";
import {
  CUSTOMER_PAYMENT_METHODS,
  INVOICE_PAYMENT_METHODS,
  formatPaymentMethod,
  formatPaymentMethodMetaRows,
  sanitizePaymentMethodMeta,
  assertPaymentMethodMeta,
} from "./paymentMethods.js";
import {
  resolveReceiptPaymentMethod,
  resolveReceiptVideoCount,
  toPositiveInt,
} from "./receiptDisplay.js";

const optionalId = z
  .string()
  .min(1)
  .optional()
  .or(z.literal(""))
  .transform((v) => v || undefined);
const patchId = z
  .union([z.string().min(1), z.literal(""), z.null()])
  .optional();

export const createCustomerSchema = z.object({
  personName: z.string().trim().optional().or(z.literal("")),
  companyName: z.string().optional(),
  jobTitle: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().min(8),
  city: z.string().optional(),
  address: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  source: z.string().optional(),
  sourceOther: z.string().optional(),
  salesOwnerId: optionalId,
  notes: z.string().optional(),
  asManagedCustomer: z.boolean().optional(),
});

export const updateCustomerSchema = z.object({
  personName: z.string().trim().min(1).optional(),
  companyName: z.string().optional(),
  jobTitle: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().min(8).optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  source: z.string().optional(),
  sourceOther: z.string().optional(),
  salesOwnerId: patchId,
  notes: z.string().optional(),
  nextFollowUpAt: z.string().datetime().optional().or(z.literal("")),
  saveCustomerInfo: z.boolean().optional(),
});

export const addInteractionSchema = z.object({
  type: z
    .enum([
      "CONTACT",
      "CALL",
      "MESSAGE",
      "WHATSAPP",
      "INFORMATION_SENT",
      "PROPOSAL_SENT",
      "PRICE_SENT",
      "WAITING_DECISION",
      "NOTE",
    ])
    .default("CONTACT"),
  body: z.string().trim().min(1).max(4000),
});

export const changeStageSchema = z.object({
  stage: z.string().min(1),
});

export const transferCustomersSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
});

export const bulkDeleteCustomersSchema = z.object({
  ids: z.array(z.string().trim().min(1).max(64)).min(1).max(100),
});

export function normalizeBulkCustomerIds(ids) {
  return [
    ...new Set(
      (ids || []).map((id) => String(id || "").trim()).filter(Boolean),
    ),
  ];
}

const paymentMethodMetaSchema = z
  .object({
    hesabPayAccount: z.string().trim().max(200).optional(),
    officeAddress: z.string().trim().max(400).optional(),
    responsibleName: z.string().trim().max(120).optional(),
    responsiblePhone: z.string().trim().max(40).optional(),
    bankInfo: z.string().trim().max(800).optional(),
    bankCardNumber: z.string().trim().max(80).optional(),
  })
  .optional();

export const createInvoiceSchema = z.object({
  videoCount: z.coerce.number().int().positive().optional(),
  description: z.string().trim().max(2000).optional(),
  amount: z.coerce.number().positive().optional(),
  totalAmount: z.coerce.number().positive().optional(),
  paidAmount: z.coerce.number().min(0).optional(),
  dueAt: z.string().datetime().optional().or(z.literal("")),
  notes: z.string().trim().max(4000).optional(),
  paymentMethod: z.enum(CUSTOMER_PAYMENT_METHODS).optional(),
  paymentMethodMeta: paymentMethodMetaSchema,
  items: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(400),
        quantity: z.coerce.number().positive().default(1),
        unitPrice: z.coerce.number().nonnegative(),
      }),
    )
    .optional(),
});

export const createCustomerInvoiceSchema = z.object({
  videoCount: z.coerce.number().int().positive(),
  description: z.string().trim().max(2000).optional(),
  totalAmount: z.coerce.number().positive(),
  paidAmount: z.coerce.number().min(0).optional().default(0),
  notes: z.string().trim().max(4000).optional(),
  paymentMethod: z.enum(INVOICE_PAYMENT_METHODS),
  paymentMethodMeta: paymentMethodMetaSchema,
});

export const ingestWhatsappSchema = z.object({
  from: z.string().min(5),
  text: z.string().max(4000).optional(),
  name: z.string().max(120).optional(),
  profileName: z.string().max(120).optional(),
});

export const updateOpportunityDetailsSchema = z.object({
  agreedPrice: z.coerce
    .number()
    .positive({ message: "قیمت مجموعی پروژه الزامی است" }),
  /** @deprecated Ignored — advance/total paid is always derived from payment records. */
  advancePayment: z.coerce.number().nonnegative().optional().nullable(),
  agreedTerms: z.string().min(1, { message: "شرایط توافق‌شده الزامی است" }),
  /** ADMIN/MANAGER only — allow editing a locked contract. */
  adminOverride: z.boolean().optional(),
});

export const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1).optional(),
  opportunityId: z.string().min(1).optional(),
  amount: z.coerce.number().positive(),
  method: z.enum(CUSTOMER_PAYMENT_METHODS, {
    required_error: "روش پرداخت الزامی است",
    invalid_type_error: "روش پرداخت معتبر نیست",
  }),
  paymentMethodMeta: paymentMethodMetaSchema,
  reference: z.string().optional(),
  attachmentKey: z.string().optional(),
  allowOverpayment: z.boolean().optional(),
});

export const updatePaymentSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  method: z
    .enum(CUSTOMER_PAYMENT_METHODS, {
      invalid_type_error: "روش پرداخت معتبر نیست",
    })
    .optional(),
  notes: z.string().optional().nullable(),
  allowOverpayment: z.boolean().optional(),
});

export const rejectPaymentSchema = z.object({
  rejectionReason: z
    .string()
    .trim()
    .min(3, { message: "دلیل رد پرداخت الزامی است" })
    .max(1000),
});

function normalizeSource(source, sourceOther) {
  if (!source?.trim()) return null;
  const code = source.trim().toUpperCase();
  if (code === "OTHER") {
    const detail = sourceOther?.trim();
    return detail ? `OTHER:${detail}` : "OTHER";
  }
  if (LEAD_SOURCE_CODES.includes(code)) return code;
  return source.trim();
}

function sourceAuditValue(source) {
  if (!source) return null;
  if (source.startsWith("OTHER:")) {
    return { code: "OTHER", detail: source.slice(6) };
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
    throw new AppError(
      "مسئول فروش انتخاب‌شده معتبر نیست",
      400,
      "INVALID_SALES_OWNER",
    );
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
      orderBy: { fullName: "asc" },
    });

    return {
      leadSources: LEAD_SOURCE_CODES.map((code) => ({
        code,
        label: LEAD_SOURCE_LABELS[code],
      })),
      paymentMethods: CUSTOMER_PAYMENT_METHODS.map((code) => ({
        code,
        label: formatPaymentMethod(code),
      })),
      salesReps: salesReps.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        roleCode: u.role.code,
      })),
      ...pipelineCatalog(),
    };
  },

  async listCustomers(
    {
      q,
      source,
      salesOwnerId,
      stage,
      category,
      dateFrom,
      dateTo,
      sort,
      scope,
      page = 1,
      pageSize = 20,
    },
    auth,
  ) {
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const where = { deletedAt: null };
    const and = [];
    const scopeCondition = customerListScopeCondition(scope);
    if (scopeCondition) and.push(scopeCondition);
    if (source) {
      where.source = source === "OTHER" ? { startsWith: "OTHER" } : source;
    }
    assertSalesCustomerListOwnerFilter(salesOwnerId, auth);
    const salesFilter = salesCustomerListFilter(auth);
    if (salesFilter) {
      and.push(salesFilter);
    } else if (salesOwnerId) {
      where.salesOwnerId = salesOwnerId;
    }
    if (stage) where.pipelineStage = canonicalizeStage(stage);
    if (category) {
      const catWhere = buildCategoryWhere(String(category).toUpperCase());
      if (catWhere) and.push(catWhere);
    }
    if (dateFrom || dateTo) {
      const createdAt = {};
      if (dateFrom) createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        createdAt.lte = end;
      }
      where.createdAt = createdAt;
    }
    if (q) {
      const trimmed = q.trim();
      const digits = trimmed.replace(/\D/g, "");
      const code = normalizeCustomerCodeQuery(trimmed);
      const or = [
        { personName: { contains: trimmed, mode: "insensitive" } },
        { companyName: { contains: trimmed, mode: "insensitive" } },
        { customerCode: { contains: code, mode: "insensitive" } },
        { source: { contains: trimmed, mode: "insensitive" } },
        {
          salesOwner: { fullName: { contains: trimmed, mode: "insensitive" } },
        },
      ];
      if (digits) {
        or.push({ normalizedWhatsapp: { contains: digits } });
        or.push({ phone: { contains: digits } });
        or.push({ whatsappRaw: { contains: digits } });
      }
      and.push({ OR: or });
    }
    if (and.length) where.AND = and;

    const orderBy =
      sort === "createdAt"
        ? { createdAt: "desc" }
        : sort === "lastContact"
          ? { lastContactAt: "desc" }
          : sort === "name"
            ? { personName: "asc" }
            : { updatedAt: "desc" };

    const [items, total] = await Promise.all([
      prisma.crmCustomer.findMany({
        where,
        include: {
          salesOwner: { select: { id: true, fullName: true } },
          opportunities: {
            where: { deletedAt: null },
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: { agreedPrice: true, pipelineStage: true },
          },
          payments: {
            where: { verification: "VERIFIED" },
            select: { id: true },
            take: 1,
          },
          _count: {
            select: {
              projects: { where: { deletedAt: null } },
              invoices: true,
              payments: true,
            },
          },
        },
        orderBy,
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
      prisma.crmCustomer.count({ where }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / safePageSize));
    return {
      items: items.map((row) => serializeListItem(row, auth)),
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages,
    };
  },

  async getDashboard(auth, { scope } = {}) {
    const where = { deletedAt: null };
    const and = [];
    const scopeCondition = customerListScopeCondition(scope);
    if (scopeCondition) and.push(scopeCondition);
    const salesFilter = salesCustomerListFilter(auth);
    if (salesFilter) and.push(salesFilter);
    if (and.length) where.AND = and;
    const activeWhere = where;
    const grouped = await prisma.crmCustomer.groupBy({
      by: ["pipelineStage"],
      where: activeWhere,
      _count: { _all: true },
    });
    const byStage = Object.fromEntries(CRM_STAGES.map((s) => [s, 0]));
    let total = 0;
    for (const row of grouped) {
      const stage = canonicalizeStage(row.pipelineStage);
      byStage[stage] = (byStage[stage] || 0) + row._count._all;
      total += row._count._all;
    }
    const categories = {};
    const categoryCodes = ["GHOST", "INTERESTED", "FOLLOW_UP", "OUR_CUSTOMERS"];
    const categoryCounts = await Promise.all(
      categoryCodes.map(async (code) => {
        const catWhere = buildCategoryWhere(code);
        const count = catWhere
          ? await prisma.crmCustomer.count({
              where: { AND: [activeWhere, catWhere] },
            })
          : 0;
        return [code, count];
      }),
    );
    for (const [code, count] of categoryCounts) {
      categories[code] = count;
    }
    return {
      total,
      stages: byStage,
      categories,
    };
  },
  async getCustomer(id, extras = {}) {
    const customer = await prisma.crmCustomer.findFirst({
      where: { id, deletedAt: null },
      include: {
        opportunities: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
        },
        portalAccount: true,
        clientAssets: { where: { deletedAt: null } },
        projects: {
          where: { deletedAt: null },
          select: { id: true, code: true, status: true, title: true },
        },
        invoices: {
          where: {
            status: { not: "CANCELED" },
            AND: [
              { OR: [{ projectId: null }, { project: { deletedAt: null } }] },
              {
                OR: [
                  { opportunityId: { not: null } },
                  { projectId: { not: null } },
                ],
              },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        payments: {
          where: {
            OR: [
              { invoiceId: null },
              {
                invoice: {
                  status: { not: "CANCELED" },
                  AND: [
                    {
                      OR: [
                        { projectId: null },
                        { project: { deletedAt: null } },
                      ],
                    },
                    {
                      OR: [
                        { opportunityId: { not: null } },
                        { projectId: { not: null } },
                      ],
                    },
                  ],
                },
              },
            ],
          },
          include: {
            invoice: { select: { id: true, invoiceNumber: true } },
          },
          orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
          take: 100,
        },
        salesOwner: true,
        _count: {
          select: {
            invoices: true,
            payments: true,
          },
        },
      },
    });
    if (!customer) throw new AppError("مشتری یافت نشد", 404, "NOT_FOUND");
    assertSalesCustomerAccess(customer, extras.auth);

    const recorderIds = [
      ...new Set(customer.payments.map((p) => p.recordedById).filter(Boolean)),
    ];
    const [recorders, financeByOpp, activities, verifiedProbe] = await Promise.all([
      recorderIds.length
        ? prisma.user.findMany({
            where: { id: { in: recorderIds } },
            select: { id: true, fullName: true },
          })
        : [],
      batchOpportunityFinanceSnapshots(prisma, customer.opportunities),
      listCrmActivities(prisma, customer.id),
      prisma.payment.findFirst({
        where: { crmCustomerId: customer.id, verification: "VERIFIED" },
        select: { id: true },
      }),
    ]);
    const recorderById = Object.fromEntries(recorders.map((u) => [u.id, u]));

    const payments = customer.payments.map((p) => ({
      ...p,
      methodLabel: formatPaymentMethod(p.method),
      recordedBy: p.recordedById ? recorderById[p.recordedById] || null : null,
    }));

    const opportunities = customer.opportunities.map((opp) => {
      const finance =
        financeByOpp.get(opp.id) || computeFinanceSnapshot(opp.agreedPrice, 0);
      return {
        ...opp,
        advancePayment: finance.totalPaid,
        finance,
      };
    });

    const portal = customer.portalAccount;
    const portalAccount = portal
      ? {
          id: portal.id,
          crmCustomerId: portal.crmCustomerId,
          normalizedWhatsapp: portal.normalizedWhatsapp,
          isActive: portal.isActive,
          registeredAt: portal.registeredAt,
          createdAt: portal.createdAt,
          updatedAt: portal.updatedAt,
          deletedAt: portal.deletedAt,
        }
      : null;
    const portalCredentials = serializePortalCredentials(customer, extras.auth);
    const { _count, ...customerRest } = customer;

    return withCrmView(
      {
        ...customerRest,
        portalAccount,
        portalCredentials,
        opportunities,
        payments,
        activities,
      },
      extras.auth,
      {
        hasProject: customer.projects.length > 0,
        hasInvoice: Boolean(_count?.invoices),
        hasPayment: Boolean(_count?.payments),
        hasVerifiedPayment: Boolean(verifiedProbe),
      },
    );
  },

  async createCustomer(data, auth, req) {
    const parsed = parseInternationalPhone(data.whatsapp);
    const normalized = parsed.digits;

    const lookupKeys = getWhatsappLookupKeys(data.whatsapp);
    const existing = await prisma.crmCustomer.findFirst({
      where: { normalizedWhatsapp: { in: lookupKeys } },
    });
    if (existing && !existing.deletedAt) {
      throw new AppError(
        "مشتری با این شماره واتساپ موجود است",
        409,
        "DUPLICATE_WHATSAPP",
        {
          customerId: existing.id,
          customerCode: existing.customerCode,
        },
      );
    }

    // Number belongs to a customer merged into another profile — point to the survivor (P-03).
    if (existing?.deletedAt && existing.notes?.startsWith("MERGED_INTO:")) {
      const survivorId = existing.notes.slice("MERGED_INTO:".length);
      throw new AppError(
        "این شماره قبلاً در یک پروفایل دیگر ادغام شده است",
        409,
        "DUPLICATE_WHATSAPP",
        {
          customerId: survivorId,
        },
      );
    }

    const stage = "NEW_LEAD";
    const personName = String(data.personName || "").trim() || "سرنخ جدید";

    const normalizedSource =
      normalizeSource(data.source, data.sourceOther) || "MANUAL";
    const salesOwnerId = await assertSalesOwnerId(
      data.salesOwnerId || auth.userId,
    );

    const customer = await prisma.$transaction(async (tx) => {
      const customerCode =
        existing?.customerCode || (await allocateCustomerCode(tx));
      const baseData = {
        customerCode,
        personName,
        companyName: data.companyName,
        jobTitle: data.jobTitle,
        phone: data.phone || parsed.e164,
        whatsappRaw: parsed.e164,
        normalizedWhatsapp: normalized,
        phoneCountryIso: parsed.country,
        city: data.city,
        address: data.address,
        email: data.email || null,
        source: normalizedSource,
        salesOwnerId,
        pipelineStage: stage,
        portalStatus: "NOT_ELIGIBLE",
        notes: data.notes,
        lastContactAt: new Date(),
        lostReason: null,
        convertedAt: data.asManagedCustomer ? new Date() : null,
      };

      // Unique constraint covers soft-deleted rows too — restore instead of insert.
      const created = existing
        ? await tx.crmCustomer.update({
            where: { id: existing.id },
            data: {
              ...baseData,
              deletedAt: null,
              convertedAt: data.asManagedCustomer ? new Date() : null,
            },
          })
        : await tx.crmCustomer.create({ data: baseData });

      await tx.opportunity.create({
        data: {
          crmCustomerId: created.id,
          title: `فرصت اولیه — ${getCustomerPersonName({ personName, companyName: data.companyName })}`,
          pipelineStage: stage,
          serviceId: null,
          lostReason: null,
        },
      });

      await applyCrmEvent(tx, {
        customerId: created.id,
        event: CRM_EVENTS.LEAD_CREATED,
        actorId: auth.userId,
        actorType: "USER",
        source: normalizedSource,
        title: "سرنخ ایجاد شد",
        note: data.notes,
        notify: false,
      });

      await notifyManagersOnce(
        buildLeadCreatedNotification({
          customerId: created.id,
          personName,
          phone: parsed.e164,
          customerCode: created.customerCode,
          source: normalizedSource,
        }),
        tx,
      );

      if (salesOwnerId && salesOwnerId !== auth.userId) {
        await createNotificationOnce(
          {
            userId: salesOwnerId,
            eventKey: `lead.assigned:${created.id}:${salesOwnerId}`,
            title: "سرنخ جدید به شما اختصاص یافت",
            body: `${personName} — ${created.customerCode}`,
            link: `/crm/${created.id}`,
            meta: { type: "LEAD_ASSIGNED", customerId: created.id },
          },
          tx,
        );
      }

      return created;
    });

    await writeAudit({
      userId: auth.userId,
      action: "CRM_LEAD_CREATE",
      entityType: "CrmCustomer",
      entityId: customer.id,
      after: {
        whatsapp: normalized,
        customerCode: customer.customerCode,
        source: sourceAuditValue(customer.source),
        salesOwnerId: customer.salesOwnerId,
      },
      req,
    });

    return this.getCustomer(customer.id, { auth });
  },

  async updateCustomer(id, data, auth, req) {
    const before = await this.getCustomer(id, { auth });

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
      patch.nextFollowUpAt = data.nextFollowUpAt
        ? new Date(data.nextFollowUpAt)
        : null;
    }
    if (data.source !== undefined || data.sourceOther !== undefined) {
      patch.source = normalizeSource(
        data.source ?? before.source?.split(":")[0] ?? "",
        data.sourceOther,
      );
    }
    if (data.salesOwnerId !== undefined) {
      patch.salesOwnerId = data.salesOwnerId
        ? await assertSalesOwnerId(data.salesOwnerId)
        : null;
    }
    if (data.whatsapp) {
      const parsed = parseInternationalPhone(data.whatsapp);
      if (!whatsappNumbersMatch(parsed.digits, before.normalizedWhatsapp)) {
        const clashKeys = getWhatsappLookupKeys(data.whatsapp);
        const clash = await prisma.crmCustomer.findFirst({
          where: {
            normalizedWhatsapp: { in: clashKeys },
            deletedAt: null,
            id: { not: id },
          },
          select: { id: true, customerCode: true },
        });
        if (clash) {
          throw new AppError(
            "این شماره واتساپ متعلق به سرنخ دیگری است",
            409,
            "DUPLICATE_WHATSAPP",
            {
              customerId: clash.id,
              customerCode: clash.customerCode,
            },
          );
        }
        patch.whatsappRaw = parsed.e164;
        patch.normalizedWhatsapp = parsed.digits;
        patch.phoneCountryIso = parsed.country;
        const history = Array.isArray(before.previousWhatsapp)
          ? before.previousWhatsapp
          : [];
        patch.previousWhatsapp = [
          ...history,
          {
            digits: before.normalizedWhatsapp,
            raw: before.whatsappRaw,
            changedAt: new Date().toISOString(),
          },
        ];
      }
    }
    if (data.saveCustomerInfo) {
      patch.customerInfoSavedAt = new Date();
    }

    await prisma.$transaction(async (tx) => {
      await tx.crmCustomer.update({ where: { id }, data: patch });
      if (
        patch.normalizedWhatsapp &&
        patch.normalizedWhatsapp !== before.normalizedWhatsapp
      ) {
        await recordCrmActivity(tx, {
          crmCustomerId: id,
          type: ACTIVITY_TYPES.PHONE_CHANGED,
          title: "شماره واتساپ به‌روزرسانی شد",
          body: `${before.normalizedWhatsapp} → ${patch.normalizedWhatsapp}`,
          actorId: auth.userId,
          actorType: "USER",
        });
      }
      if (data.saveCustomerInfo) {
        await recordCrmActivity(tx, {
          crmCustomerId: id,
          type: ACTIVITY_TYPES.CUSTOMER_INFO_SAVED,
          title: "اطلاعات مشتری ذخیره شد",
          actorId: auth.userId,
          actorType: "USER",
        });
      }
      if (patch.salesOwnerId && patch.salesOwnerId !== before.salesOwnerId) {
        await recordCrmActivity(tx, {
          crmCustomerId: id,
          type: ACTIVITY_TYPES.ASSIGNED,
          title: "مسئول فروش تعیین شد",
          actorId: auth.userId,
          actorType: "USER",
          relatedType: "User",
          relatedId: patch.salesOwnerId,
        });
        if (patch.salesOwnerId !== auth.userId) {
          await createNotificationOnce(
            {
              userId: patch.salesOwnerId,
              eventKey: `lead.assigned:${id}:${patch.salesOwnerId}:${Date.now()}`,
              title: "سرنخ به شما اختصاص یافت",
              body: `${before.personName}`,
              link: `/crm/${id}`,
              meta: { type: "LEAD_ASSIGNED", customerId: id },
            },
            tx,
          );
        }
      }
    });
    const updated = await this.getCustomer(id, { auth });

    await writeAudit({
      userId: auth.userId,
      action: "CRM_CUSTOMER_UPDATE",
      entityType: "CrmCustomer",
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
    const opp = await prisma.opportunity.findFirst({
      where: { id: opportunityId, deletedAt: null },
    });
    if (!opp) throw new AppError("فرصت یافت نشد", 404, "NOT_FOUND");

    const price = Number(agreedPrice);
    const terms = String(agreedTerms || "").trim();
    if (!(price > 0) || Number.isNaN(price)) {
      throw new AppError("قیمت مجموعی پروژه الزامی است", 400, "VALIDATION");
    }
    if (!terms) {
      throw new AppError("شرایط توافق‌شده الزامی است", 400, "VALIDATION");
    }

    const isAdmin = auth?.roleCode === "ADMIN" || auth?.roleCode === "MANAGER";
    if (opp.contractLocked) {
      if (!(adminOverride && isAdmin)) {
        throw new AppError(
          "این قرارداد قفل شده و دیگر قابل ویرایش نمی‌باشد.",
          403,
          "CONTRACT_LOCKED",
        );
      }
    }

    const before = {
      agreedPrice: opp.agreedPrice,
      advancePayment: opp.advancePayment,
      agreedTerms: opp.agreedTerms,
      contractLocked: opp.contractLocked,
    };

    const shouldConfirmOrder = ![
      "DELIVERED",
      "LOST_CANCELED",
      "REPEAT_CUSTOMER",
    ].includes(canonicalizeStage(opp.pipelineStage));

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
        },
      });
      if (shouldConfirmOrder) {
        await applyCrmEvent(tx, {
          customerId: opp.crmCustomerId,
          opportunityId,
          event: CRM_EVENTS.ORDER_CONFIRMED,
          actorId: auth.userId,
          actorType: "USER",
          source: "CONTRACT",
          relatedType: "Opportunity",
          relatedId: opportunityId,
          title: "سفارش تأیید شد",
        });
      }
      const { opportunity, finance } = await syncOpportunityFinance(
        tx,
        opportunityId,
        {
          persist: true,
        },
      );
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
      action: "OPPORTUNITY_DETAILS_UPDATE",
      entityType: "Opportunity",
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
    if (auth?.roleCode !== "ADMIN" && auth?.roleCode !== "MANAGER") {
      throw new AppError(
        "فقط مدیر مجاز به بازکردن قفل قرارداد است",
        403,
        "FORBIDDEN",
      );
    }
    const opp = await prisma.opportunity.findFirst({
      where: { id: opportunityId, deletedAt: null },
    });
    if (!opp) throw new AppError("فرصت یافت نشد", 404, "NOT_FOUND");
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
      action: "OPPORTUNITY_CONTRACT_UNLOCK",
      entityType: "Opportunity",
      entityId: opportunityId,
      before: { contractLocked: true },
      after: { contractLocked: false },
      req,
    });

    return updated;
  },

  async createDepositInvoice(opportunityId, body, auth, req) {
    return this.createInvoice(opportunityId, body, auth, req);
  },

  async ensureOpenOpportunity(tx, customer) {
    const existing = await tx.opportunity.findFirst({
      where: {
        crmCustomerId: customer.id,
        deletedAt: null,
        pipelineStage: { not: "LOST_CANCELED" },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return existing;
    return tx.opportunity.create({
      data: {
        crmCustomerId: customer.id,
        title: `فرصت — ${getCustomerPersonName(customer)}`,
        pipelineStage: canonicalizeStage(customer.pipelineStage),
        serviceId: null,
        lostReason: null,
      },
    });
  },

  async createCustomerInvoice(customerId, body = {}, auth, req) {
    const customer = await prisma.crmCustomer.findFirst({
      where: { id: customerId, deletedAt: null },
    });
    if (!customer) throw new AppError("مشتری یافت نشد", 404, "NOT_FOUND");
    assertSalesCustomerAccess(customer, auth);
    if (isClosedStage(customer.pipelineStage)) {
      throw new AppError(
        "برای سرنخ لغوشده نمی‌توان فاکتور صادر کرد",
        400,
        "LEAD_CLOSED",
      );
    }

    const total = roundMoney(body.totalAmount);
    if (!(total > 0)) {
      throw new AppError("مبلغ کل فاکتور الزامی است", 400, "VALIDATION");
    }
    const paidAmount = roundMoney(body.paidAmount || 0);
    if (paidAmount > total) {
      throw new AppError(
        "مبلغ پرداخت‌شده نمی‌تواند از مبلغ کل بیشتر باشد",
        400,
        "VALIDATION",
      );
    }
    if (!body.paymentMethod) {
      throw new AppError("روش پرداخت الزامی است", 400, "VALIDATION");
    }
    assertPaymentMethodMeta(body.paymentMethod, body.paymentMethodMeta);

    const videoCount = Number(body.videoCount);
    const qty = videoCount > 0 ? videoCount : 1;
    const unit = qty > 0 ? roundMoney(total / qty) : total;
    const items =
      Array.isArray(body.items) && body.items.length
        ? body.items.map((item) => {
            const quantity = roundMoney(item.quantity || 1);
            const unitPrice = roundMoney(item.unitPrice);
            return {
              description: item.description,
              quantity,
              unitPrice,
              amount: roundMoney(quantity * unitPrice),
            };
          })
        : [
            {
              description: body.description || `تولید ${qty} ویدیو`,
              quantity: qty,
              unitPrice: unit,
              amount: total,
            },
          ];
    const itemsTotal = roundMoney(
      items.reduce((sum, item) => sum + Number(item.amount), 0),
    );
    const invoiceTotal = itemsTotal > 0 ? itemsTotal : total;
    const paymentMethod = body.paymentMethod || null;
    const paymentMethodMeta = paymentMethod
      ? sanitizePaymentMethodMeta(paymentMethod, body.paymentMethodMeta)
      : undefined;

    const invoice = await prisma.$transaction(async (tx) => {
      const count = await tx.invoice.count();
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;

      const inv = await tx.invoice.create({
        data: {
          invoiceNumber,
          crmCustomerId: customer.id,
          opportunityId: null,
          projectId: null,
          status: "ISSUED",
          issuedAt: new Date(),
          dueAt: body.dueAt ? new Date(body.dueAt) : null,
          subtotal: invoiceTotal,
          total: invoiceTotal,
          notes: body.notes || null,
          videoCount: toPositiveInt(body.videoCount) || toPositiveInt(qty) || null,
          paymentMethod,
          paymentMethodMeta,
          items: { create: items },
        },
        include: { items: true },
      });

      await applyCrmEvent(tx, {
        customerId: customer.id,
        opportunityId: null,
        event: CRM_EVENTS.INVOICE_CREATED,
        actorId: auth.userId,
        actorType: "USER",
        source: "INVOICE",
        relatedType: "Invoice",
        relatedId: inv.id,
        title: "فاکتور ایجاد شد",
        note: `شماره فاکتور ${invoiceNumber}`,
        meta: {
          invoiceNumber,
          total: invoiceTotal,
          origin: "CRM_SALES",
        },
      });

      return inv;
    });

    await writeAudit({
      userId: auth.userId,
      action: "INVOICE_CREATE",
      entityType: "Invoice",
      entityId: invoice.id,
      after: {
        total: invoiceTotal,
        opportunityId: null,
        origin: "CRM_SALES",
        invoiceNumber: invoice.invoiceNumber,
        crmCustomerId: customer.id,
      },
      req,
    });

    let paymentId = null;
    if (paidAmount > 0) {
      const paymentResult = await this.recordPayment(
        {
          invoiceId: invoice.id,
          amount: paidAmount,
          method: body.paymentMethod,
          paymentMethodMeta: body.paymentMethodMeta,
          reference: invoice.invoiceNumber,
        },
        auth,
        req,
      );
      paymentId = paymentResult.id || null;
    }

    const latest = await prisma.crmCustomer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { convertedAt: true },
    });

    const view = await this.getInvoiceView(invoice.id);
    return {
      ...view,
      customerId,
      customerConverted: Boolean(latest?.convertedAt),
      paymentId,
    };
  },

  async listCustomerInvoices(customerId, auth) {
    const customer = await prisma.crmCustomer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: {
        id: true,
        customerCode: true,
        personName: true,
        companyName: true,
        salesOwnerId: true,
      },
    });
    if (!customer) throw new AppError("مشتری یافت نشد", 404, "NOT_FOUND");
    assertSalesCustomerAccess(customer, auth);

    const invoices = await prisma.invoice.findMany({
      where: {
        crmCustomerId: customerId,
        opportunityId: null,
        projectId: null,
        status: { not: "CANCELED" },
      },
      orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
      include: { items: true },
    });

    const invoiceIds = invoices.map((inv) => inv.id);
    const paidByInvoice = new Map();
    if (invoiceIds.length) {
      const grouped = await prisma.payment.groupBy({
        by: ["invoiceId"],
        where: {
          invoiceId: { in: invoiceIds },
          verification: "VERIFIED",
        },
        _sum: { amount: true },
      });
      for (const row of grouped) {
        if (!row.invoiceId) continue;
        paidByInvoice.set(row.invoiceId, roundMoney(row._sum.amount || 0));
      }
    }

    const customerSummary = {
      id: customer.id,
      customerCode: customer.customerCode,
      personName: customer.personName,
      companyName: customer.companyName,
    };

    return {
      customer: customerSummary,
      items: invoices.map((inv) => {
        const total = roundMoney(inv.total);
        const paidAmount = paidByInvoice.get(inv.id) || 0;
        return {
          ...inv,
          paymentMethodLabel: formatPaymentMethod(inv.paymentMethod),
          paymentMethodMetaRows: formatPaymentMethodMetaRows(
            inv.paymentMethod,
            inv.paymentMethodMeta,
          ),
          paidAmount,
          remainingAmount: roundMoney(Math.max(0, total - paidAmount)),
          isCrmInvoice: true,
          customer: customerSummary,
        };
      }),
    };
  },

  async createInvoice(opportunityId, body = {}, auth, req) {
    const opp = await prisma.opportunity.findFirst({
      where: { id: opportunityId, deletedAt: null },
      include: { crmCustomer: true },
    });
    if (!opp) throw new AppError("فرصت یافت نشد", 404, "NOT_FOUND");
    if (opp.agreedPrice == null || Number(opp.agreedPrice) <= 0) {
      throw new AppError(
        "ابتدا قیمت مجموعی پروژه را ثبت کنید",
        400,
        "AGREED_PRICE_REQUIRED",
      );
    }
    if (!opp.agreedTerms?.trim()) {
      throw new AppError(
        "ابتدا شرایط توافق‌شده را ثبت کنید",
        400,
        "AGREED_TERMS_REQUIRED",
      );
    }

    const agreed = roundMoney(opp.agreedPrice);
    const requested = body.totalAmount ?? body.amount;
    const total = roundMoney(
      requested != null && requested !== "" ? requested : agreed,
    );
    if (!(total > 0)) {
      throw new AppError("مبلغ فاکتور نامعتبر است", 400, "VALIDATION");
    }

    const qty = body.videoCount ? Number(body.videoCount) : 1;
    const unit = qty > 0 ? roundMoney(total / qty) : total;
    const items =
      Array.isArray(body.items) && body.items.length
        ? body.items.map((item) => {
            const quantity = roundMoney(item.quantity || 1);
            const unitPrice = roundMoney(item.unitPrice);
            return {
              description: item.description,
              quantity,
              unitPrice,
              amount: roundMoney(quantity * unitPrice),
            };
          })
        : [
            {
              description: body.description || "خدمات تولید محتوای ویدیویی",
              quantity: qty,
              unitPrice: unit,
              amount: total,
            },
          ];

    const itemsTotal = roundMoney(
      items.reduce((sum, item) => sum + Number(item.amount), 0),
    );
    const invoiceTotal = itemsTotal > 0 ? itemsTotal : total;
    const paymentMethod = body.paymentMethod || null;
    const paymentMethodMeta = paymentMethod
      ? sanitizePaymentMethodMeta(paymentMethod, body.paymentMethodMeta)
      : undefined;

    const invoice = await prisma.$transaction(async (tx) => {
      const count = await tx.invoice.count();
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;
      const paidSnap = await syncOpportunityFinance(tx, opportunityId, {
        persist: false,
      });
      const paidAmount = roundMoney(paidSnap.finance.totalPaid);
      const remainingAmount = roundMoney(
        Math.max(0, invoiceTotal - paidAmount),
      );

      const inv = await tx.invoice.create({
        data: {
          invoiceNumber,
          crmCustomerId: opp.crmCustomerId,
          opportunityId: opp.id,
          status:
            paidAmount <= 0
              ? "ISSUED"
              : remainingAmount <= 0
                ? "PAID"
                : "PARTIALLY_PAID",
          issuedAt: new Date(),
          dueAt: body.dueAt ? new Date(body.dueAt) : null,
          subtotal: invoiceTotal,
          total: invoiceTotal,
          notes: body.notes || null,
          videoCount: toPositiveInt(body.videoCount) || toPositiveInt(qty) || null,
          paymentMethod,
          paymentMethodMeta,
          items: { create: items },
        },
        include: { items: true },
      });

      await applyCrmEvent(tx, {
        customerId: opp.crmCustomerId,
        opportunityId,
        event: CRM_EVENTS.INVOICE_CREATED,
        actorId: auth.userId,
        actorType: "USER",
        source: "INVOICE",
        relatedType: "Invoice",
        relatedId: inv.id,
        title: "فاکتور ایجاد شد",
        note: `شماره فاکتور ${invoiceNumber}`,
        meta: { invoiceNumber, total: invoiceTotal, remainingAmount },
      });

      return { ...inv, paidAmount, remainingAmount };
    });

    await writeAudit({
      userId: auth.userId,
      action: "INVOICE_CREATE",
      entityType: "Invoice",
      entityId: invoice.id,
      after: {
        total: invoiceTotal,
        opportunityId,
        invoiceNumber: invoice.invoiceNumber,
      },
      req,
    });
    return invoice;
  },

  async getInvoiceView(invoiceId) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId },
      include: {
        items: true,
        crmCustomer: {
          select: {
            id: true,
            customerCode: true,
            personName: true,
            companyName: true,
            phone: true,
            whatsappRaw: true,
            email: true,
          },
        },
      },
    });
    if (!invoice) throw new AppError("فاکتور یافت نشد", 404, "NOT_FOUND");

    let paidAmount = 0;
    const verified = await prisma.payment.aggregate({
      where: { invoiceId: invoice.id, verification: "VERIFIED" },
      _sum: { amount: true },
    });
    paidAmount = roundMoney(verified._sum.amount || 0);
    if (invoice.opportunityId) {
      const snap = await syncOpportunityFinance(prisma, invoice.opportunityId, {
        persist: false,
      });
      paidAmount = roundMoney(snap.finance.totalPaid);
    }
    const total = roundMoney(invoice.total);
    const remainingAmount = roundMoney(Math.max(0, total - paidAmount));
    const isCrmInvoice = !invoice.opportunityId && !invoice.projectId;
    const latestPayment = await prisma.payment.findFirst({
      where: { invoiceId: invoice.id },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      select: { id: true, recordedById: true },
    });
    let recordedByName = null;
    if (latestPayment?.recordedById) {
      const recorder = await prisma.user.findUnique({
        where: { id: latestPayment.recordedById },
        select: { fullName: true },
      });
      recordedByName = recorder?.fullName || null;
    }

    const website = env.webUrl
      ? String(env.webUrl)
          .replace(/^https?:\/\//i, "")
          .replace(/\/$/, "")
      : null;

    return {
      ...invoice,
      paymentMethodLabel: formatPaymentMethod(invoice.paymentMethod),
      paymentMethodMetaRows: formatPaymentMethodMetaRows(
        invoice.paymentMethod,
        invoice.paymentMethodMeta,
      ),
      paidAmount,
      remainingAmount,
      isCrmInvoice,
      paymentId: latestPayment?.id || null,
      recordedByName,
      statusLabel: invoiceStatusLabel(invoice.status),
      company: {
        name: "APEX SMART MARKETING",
        phone: env.contactPhone || null,
        email: env.contactEmail || null,
        website,
      },
      customer: {
        id: invoice.crmCustomer.id,
        customerCode: invoice.crmCustomer.customerCode,
        personName: invoice.crmCustomer.personName,
        companyName: invoice.crmCustomer.companyName,
        phone: invoice.crmCustomer.phone || invoice.crmCustomer.whatsappRaw,
        whatsappRaw: invoice.crmCustomer.whatsappRaw,
        email: invoice.crmCustomer.email,
      },
    };
  },

  async getInvoiceDocumentHtml(invoiceId) {
    const invoice = await this.getInvoiceView(invoiceId);
    return buildInvoiceDocumentHtml(invoice);
  },

  async recordPayment(
    {
      invoiceId,
      opportunityId,
      amount,
      method,
      paymentMethodMeta,
      reference,
      attachmentKey,
      allowOverpayment,
    },
    auth,
    req,
  ) {
    const amt = Number(amount);
    if (!(amt > 0) || Number.isNaN(amt)) {
      throw new AppError("مبلغ باید عدد مثبت باشد", 400, "VALIDATION");
    }
    const cleanMeta = assertPaymentMethodMeta(method, paymentMethodMeta || {});

    let crmCustomerId;
    let resolvedInvoiceId = invoiceId || null;
    let resolvedOpportunityId = opportunityId || null;
    let agreedPrice = 0;

    if (invoiceId) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      });
      if (!invoice) throw new AppError("فاکتور یافت نشد", 404, "NOT_FOUND");
      crmCustomerId = invoice.crmCustomerId;
      if (!resolvedOpportunityId && invoice.opportunityId) {
        resolvedOpportunityId = invoice.opportunityId;
      }
    } else if (opportunityId) {
      const opp = await prisma.opportunity.findFirst({
        where: { id: opportunityId, deletedAt: null },
      });
      if (!opp) throw new AppError("فرصت یافت نشد", 404, "NOT_FOUND");
      crmCustomerId = opp.crmCustomerId;
      agreedPrice = Number(opp.agreedPrice || 0);
    } else {
      throw new AppError("فاکتور یا فرصت الزامی است", 400, "VALIDATION");
    }

    if (resolvedOpportunityId) {
      const available = await getAvailableRemaining(prisma, {
        opportunityId: resolvedOpportunityId,
        crmCustomerId,
      });
      agreedPrice = available.projectTotal;
      if (available.projectTotal <= 0) {
        throw new AppError(
          "ابتدا قیمت مجموعی پروژه را ثبت کنید",
          400,
          "AGREED_PRICE_REQUIRED",
        );
      }
      assertPaymentWithinRemaining({
        amount: amt,
        remainingBalance: available.remainingBalance,
        allowOverpayment: !!allowOverpayment,
        auth,
      });
    }

    const year = new Date().getFullYear();
    const priorPaymentCount = await prisma.payment.count({
      where: { crmCustomerId },
    });
    const isFirstPayment = priorPaymentCount === 0;
    const seq = priorPaymentCount + 1;
    const paymentNumber =
      reference?.trim() || `PAY-${year}-${String(seq).padStart(5, "0")}`;
    const paidAt = new Date();
    const autoApprove = shouldAutoApprovePayment(auth);
    const initialVerification = autoApprove ? "VERIFIED" : "PENDING";

    let customerConverted = false;

    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          crmCustomerId,
          invoiceId: resolvedInvoiceId,
          amount: amt,
          paidAt,
          method,
          methodMeta: cleanMeta,
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
        const invoice = await tx.invoice.findUnique({
          where: { id: resolvedInvoiceId },
        });
        if (invoice) {
          const verifiedSum = await tx.payment.aggregate({
            where: { invoiceId: resolvedInvoiceId, verification: "VERIFIED" },
            _sum: { amount: true },
          });
          const received = Number(verifiedSum._sum.amount || 0);
          const total = Number(invoice.total);
          let status = "ISSUED";
          if (received <= 0) status = "ISSUED";
          else if (received < total) status = "PARTIALLY_PAID";
          else status = "PAID";
          await tx.invoice.update({
            where: { id: resolvedInvoiceId },
            data: { status },
          });
        }
      }

      if (isFirstPayment) {
        await applyCrmEvent(tx, {
          customerId: crmCustomerId,
          opportunityId: resolvedOpportunityId,
          event: autoApprove
            ? CRM_EVENTS.PAYMENT_CONFIRMED
            : CRM_EVENTS.PAYMENT_SUBMITTED,
          actorId: auth.userId,
          actorType: "USER",
          source: "PAYMENT",
          relatedType: "Payment",
          relatedId: created.id,
          title: autoApprove ? "بیعانه تأیید شد" : "پرداخت ثبت شد",
        });
      } else {
        await applyCrmEvent(tx, {
          customerId: crmCustomerId,
          opportunityId: resolvedOpportunityId,
          event: autoApprove
            ? CRM_EVENTS.PAYMENT_CONFIRMED
            : CRM_EVENTS.PAYMENT_SUBMITTED,
          actorId: auth.userId,
          actorType: "USER",
          source: "PAYMENT",
          relatedType: "Payment",
          relatedId: created.id,
          notify: autoApprove,
        });
      }

      if (!autoApprove) {
        const ctx = await resolvePaymentContext(tx, created);
        await notifyManagersOnce(
          buildPaymentPendingApprovalNotification({
            paymentId: created.id,
            amount: amt,
            method,
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

      if (isFirstPayment) {
        const conversion = await maybeAutoConvertAfterFirstVerifiedPayment(tx, {
          customerId: crmCustomerId,
          actorId: auth.userId,
          paymentId: created.id,
          trigger: "payment",
        });
        customerConverted = conversion.converted === true;
      }

      return { ...created, recordedBy, finance };
    });

    await writeAudit({
      userId: auth.userId,
      action: "PAYMENT_RECORD",
      entityType: "Payment",
      entityId: payment.id,
      after: {
        amount: amt,
        invoiceId: resolvedInvoiceId,
        opportunityId: resolvedOpportunityId || null,
        paymentNumber,
        paidAt,
        method,
        verification: initialVerification,
        awaitingApproval: !autoApprove,
        isFirstPayment,
        customerConverted,
        portalInviteUnlocked: isFirstPayment,
        receiptGenerated: true,
        finance: payment.finance,
      },
      req,
    });

    return {
      ...payment,
      methodLabel: formatPaymentMethod(payment.method),
      paymentNumber,
      isFirstPayment,
      customerConverted,
      portalInviteUnlocked: isFirstPayment,
      receiptGenerated: true,
      awaitingApproval: !autoApprove,
      approvalStatus: autoApprove ? "APPROVED" : "PENDING_APPROVAL",
      finance: payment.finance,
    };
  },

  /**
   * Update payment amount / notes and recalculate contract finance.
   */
  async updatePayment(
    paymentId,
    { amount, method, notes, allowOverpayment },
    auth,
    req,
  ) {
    const existing = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { invoice: { select: { opportunityId: true } } },
    });
    if (!existing) throw new AppError("پرداخت یافت نشد", 404, "NOT_FOUND");
    if (existing.verification === "REJECTED") {
      throw new AppError(
        "پرداخت رد‌شده قابل ویرایش نیست",
        400,
        "PAYMENT_REJECTED",
      );
    }

    const nextAmount =
      amount !== undefined ? Number(amount) : Number(existing.amount);
    if (!(nextAmount > 0) || Number.isNaN(nextAmount)) {
      throw new AppError("مبلغ باید عدد مثبت باشد", 400, "VALIDATION");
    }

    const opportunityId =
      existing.invoice?.opportunityId ||
      (
        await prisma.opportunity.findFirst({
          where: { crmCustomerId: existing.crmCustomerId, deletedAt: null },
          orderBy: { updatedAt: "desc" },
          select: { id: true },
        })
      )?.id;

    if (opportunityId && existing.verification !== "REJECTED") {
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
          ...(method !== undefined && { method }),
          ...(notes !== undefined && { notes }),
        },
      });

      let finance = null;
      if (opportunityId) {
        finance = (
          await syncOpportunityFinance(tx, opportunityId, { persist: true })
        ).finance;
      } else {
        await syncCustomerOpportunitiesFinance(tx, existing.crmCustomerId);
      }
      return { payment: updated, finance };
    });

    await writeAudit({
      userId: auth.userId,
      action: "PAYMENT_UPDATE",
      entityType: "Payment",
      entityId: paymentId,
      before: { amount: Number(existing.amount), method: existing.method },
      after: {
        amount: nextAmount,
        method: method ?? existing.method,
        finance: result.finance,
      },
      req,
    });

    return {
      ...result.payment,
      methodLabel: formatPaymentMethod(result.payment.method),
      finance: result.finance,
    };
  },

  /**
   * Delete a payment and recalculate contract finance.
   */
  async deletePayment(paymentId, auth, req) {
    const existing = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { invoice: { select: { opportunityId: true } } },
    });
    if (!existing) throw new AppError("پرداخت یافت نشد", 404, "NOT_FOUND");

    const opportunityId = existing.invoice?.opportunityId || null;

    const result = await prisma.$transaction(async (tx) => {
      await tx.payment.delete({ where: { id: paymentId } });
      let finance = null;
      if (opportunityId) {
        finance = (
          await syncOpportunityFinance(tx, opportunityId, { persist: true })
        ).finance;
      } else {
        const synced = await syncCustomerOpportunitiesFinance(
          tx,
          existing.crmCustomerId,
        );
        finance = synced[0]?.finance || null;
      }
      await applyCrmEvent(tx, {
        customerId: existing.crmCustomerId,
        opportunityId,
        event: CRM_EVENTS.PAYMENT_REVERSED,
        actorId: auth.userId,
        actorType: "USER",
        source: "PAYMENT",
        relatedType: "Payment",
        relatedId: paymentId,
        title: "پرداخت حذف / برگشت شد",
        notify: false,
      });
      return finance;
    });

    await writeAudit({
      userId: auth.userId,
      action: "PAYMENT_DELETE",
      entityType: "Payment",
      entityId: paymentId,
      before: {
        amount: Number(existing.amount),
        method: existing.method,
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

    const reason = String(rejectionReason || "").trim();
    if (reason.length < 3) {
      throw new AppError("دلیل رد پرداخت الزامی است", 400, "VALIDATION");
    }

    const existing = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: { select: { opportunityId: true, projectId: true } },
        crmCustomer: {
          select: { id: true, personName: true, companyName: true },
        },
      },
    });
    if (!existing) throw new AppError("پرداخت یافت نشد", 404, "NOT_FOUND");
    if (existing.verification === "REJECTED") {
      return { ...existing, finance: null, approvalStatus: "REJECTED" };
    }
    if (existing.verification === "VERIFIED") {
      throw new AppError(
        "پرداخت تأییدشده قابل رد نیست. ابتدا وضعیت مالی را بررسی کنید.",
        400,
        "PAYMENT_ALREADY_APPROVED",
      );
    }

    const opportunityId = existing.invoice?.opportunityId || null;
    const rejectedAt = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.update({
        where: { id: paymentId },
        data: {
          verification: "REJECTED",
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
        finance = (
          await syncOpportunityFinance(tx, opportunityId, { persist: true })
        ).finance;
      } else {
        const synced = await syncCustomerOpportunitiesFinance(
          tx,
          existing.crmCustomerId,
        );
        finance = synced[0]?.finance || null;
      }

      if (existing.recordedById && existing.recordedById !== auth.userId) {
        const ctx = await resolvePaymentContext(tx, existing);
        await createNotificationOnce(
          {
            userId: existing.recordedById,
            audience: "INTERNAL",
            ...buildPaymentRejectedNotification({
              paymentId,
              amount: existing.amount,
              method: existing.method,
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

      await applyCrmEvent(tx, {
        customerId: existing.crmCustomerId,
        opportunityId,
        event: CRM_EVENTS.PAYMENT_REJECTED,
        actorId: auth.userId,
        actorType: "USER",
        source: "PAYMENT",
        relatedType: "Payment",
        relatedId: paymentId,
        note: reason,
        title: "پرداخت رد شد",
        notify: false,
      });

      return { payment: p, finance };
    });

    await writeAudit({
      userId: auth.userId,
      action: "PAYMENT_REJECT",
      entityType: "Payment",
      entityId: paymentId,
      after: {
        verification: "REJECTED",
        method: existing.method,
        rejectionReason: reason,
        finance: result.finance,
      },
      req,
    });

    return {
      ...result.payment,
      methodLabel: formatPaymentMethod(result.payment.method),
      finance: result.finance,
      approvalStatus: "REJECTED",
    };
  },

  /** Structured receipt payload for a recorded payment. */
  async getPaymentReceipt(paymentId, auth) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            status: true,
            videoCount: true,
            notes: true,
            issuedAt: true,
            createdAt: true,
            opportunityId: true,
            projectId: true,
            paymentMethod: true,
            items: { select: { quantity: true, description: true } },
            opportunity: {
              select: { id: true, title: true, agreedTerms: true },
            },
          },
        },
        crmCustomer: {
          select: {
            id: true,
            customerCode: true,
            personName: true,
            companyName: true,
            phone: true,
            whatsappRaw: true,
            email: true,
            city: true,
            address: true,
            salesOwnerId: true,
            opportunities: {
              where: { deletedAt: null },
              orderBy: { updatedAt: "desc" },
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
    if (!payment) throw new AppError("پرداخت یافت نشد", 404, "NOT_FOUND");
    assertSalesCustomerAccess(payment.crmCustomer, auth);

    const recordedBy = payment.recordedById
      ? await prisma.user.findUnique({
          where: { id: payment.recordedById },
          select: { id: true, fullName: true },
        })
      : null;

    const opportunity = payment.invoice
      ? payment.invoice.opportunity || null
      : payment.crmCustomer.opportunities[0] || null;

    let relatedInvoice = payment.invoice || null;
    if (!relatedInvoice && opportunity?.id) {
      relatedInvoice = await prisma.invoice.findFirst({
        where: {
          crmCustomerId: payment.crmCustomerId,
          opportunityId: opportunity.id,
        },
        orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          status: true,
          videoCount: true,
          notes: true,
          issuedAt: true,
          createdAt: true,
          opportunityId: true,
          projectId: true,
          paymentMethod: true,
          items: { select: { quantity: true, description: true } },
          opportunity: {
            select: { id: true, title: true, agreedTerms: true },
          },
        },
      });
    }

    const projectCount = await prisma.project.count({
      where: { crmCustomerId: payment.crmCustomerId, deletedAt: null },
    });

    const videoCount = resolveReceiptVideoCount({
      invoiceVideoCount: relatedInvoice?.videoCount,
      invoiceItems: relatedInvoice?.items,
      invoiceNotes: relatedInvoice?.notes,
      invoiceDescription: relatedInvoice?.items?.[0]?.description,
      agreedTerms:
        relatedInvoice?.opportunity?.agreedTerms || opportunity?.agreedTerms,
      projectCount,
    });
    const methodLabel = resolveReceiptPaymentMethod({
      method: payment.method,
      invoiceMethod: relatedInvoice?.paymentMethod,
    });

    const currentAmount = roundMoney(payment.amount);
    const isVerified = payment.verification === "VERIFIED";

    let finance = {
      totalAmount: 0,
      previouslyPaid: 0,
      currentPayment: currentAmount,
      totalPaid: 0,
      remainingBalance: 0,
    };

    if (payment.invoice) {
      const inv = payment.invoice;
      const total = roundMoney(inv.total);
      let verifiedPaid = 0;
      const verifiedAgg = await prisma.payment.aggregate({
        where: { invoiceId: inv.id, verification: "VERIFIED" },
        _sum: { amount: true },
      });
      verifiedPaid = roundMoney(verifiedAgg._sum.amount || 0);
      if (inv.opportunityId) {
        const snap = await syncOpportunityFinance(prisma, inv.opportunityId, {
          persist: false,
        });
        verifiedPaid = roundMoney(snap.finance.totalPaid);
      }
      const previouslyPaid = roundMoney(
        Math.max(0, verifiedPaid - (isVerified ? currentAmount : 0)),
      );
      finance = {
        totalAmount: total,
        previouslyPaid,
        currentPayment: currentAmount,
        totalPaid: verifiedPaid,
        remainingBalance: roundMoney(Math.max(0, total - verifiedPaid)),
      };
    } else if (opportunity) {
      const { finance: oppFinance } = await syncOpportunityFinance(
        prisma,
        opportunity.id,
        { persist: false },
      );
      const total = roundMoney(oppFinance.projectTotal);
      const verifiedPaid = roundMoney(oppFinance.totalPaid);
      const previouslyPaid = roundMoney(
        Math.max(0, verifiedPaid - (isVerified ? currentAmount : 0)),
      );
      finance = {
        totalAmount: total,
        previouslyPaid,
        currentPayment: currentAmount,
        totalPaid: verifiedPaid,
        remainingBalance: roundMoney(Math.max(0, total - verifiedPaid)),
      };
    }

    const remainingForStatus = finance.remainingBalance;
    let receiptStatus = "PENDING";
    let receiptStatusLabel = "در انتظار تأیید";
    if (payment.verification === "REJECTED") {
      receiptStatus = "REJECTED";
      receiptStatusLabel = "رد شده";
    } else if (payment.verification === "VERIFIED") {
      if (remainingForStatus <= 0) {
        receiptStatus = "COMPLETED";
        receiptStatusLabel = "تکمیل‌شده";
      } else if (finance.totalPaid > 0 && remainingForStatus > 0) {
        receiptStatus = "PARTIAL";
        receiptStatusLabel = "پرداخت جزئی";
      } else {
        receiptStatus = "SUCCESS";
        receiptStatusLabel = "پرداخت موفق";
      }
    }

    const paymentNumber =
      payment.reference || `PAY-${payment.id.slice(-8).toUpperCase()}`;
    const methodMetaRows = formatPaymentMethodMetaRows(
      payment.method,
      payment.methodMeta,
    );

    const INVOICE_STATUS_LABELS = {
      DRAFT: "پیش‌نویس",
      ISSUED: "صادر شده",
      PARTIALLY_PAID: "پرداخت جزئی",
      PAID: "پرداخت شده",
      OVERDUE: "سررسید گذشته",
      CANCELED: "لغو شده",
    };

    const website = env.webUrl
      ? String(env.webUrl)
          .replace(/^https?:\/\//i, "")
          .replace(/\/$/, "")
      : null;

    return {
      receiptTitle: "رسید پرداخت",
      company: {
        name: "APEX SMART",
        tagline: "سیستم مدیریت مشتریان و پروژه‌ها",
        phone: env.contactPhone || null,
        email: env.contactEmail || null,
        website,
      },
      customer: {
        id: payment.crmCustomer.id,
        customerCode: payment.crmCustomer.customerCode,
        personName: payment.crmCustomer.personName,
        companyName: payment.crmCustomer.companyName,
        phone: payment.crmCustomer.phone || payment.crmCustomer.whatsappRaw,
        email: payment.crmCustomer.email,
        city: payment.crmCustomer.city,
        address: payment.crmCustomer.address,
      },
      contract: opportunity
        ? {
            id: opportunity.id,
            title: opportunity.title,
            agreedPrice: finance.totalAmount,
            advancePayment: finance.totalPaid,
            remainingBalance: finance.remainingBalance,
            agreedTerms: opportunity.agreedTerms || null,
          }
        : null,
      invoice: relatedInvoice
        ? {
            id: relatedInvoice.id,
            invoiceNumber: relatedInvoice.invoiceNumber,
            projectReference:
              relatedInvoice.opportunity?.title || opportunity?.title || null,
            videoCount,
            total: finance.totalAmount,
            previouslyPaid: finance.previouslyPaid,
            currentPayment: finance.currentPayment,
            totalPaid: finance.totalPaid,
            remaining: finance.remainingBalance,
            status: relatedInvoice.status,
            statusLabel:
              INVOICE_STATUS_LABELS[relatedInvoice.status] ||
              relatedInvoice.status,
            issuedAt: relatedInvoice.issuedAt || relatedInvoice.createdAt,
            notes: relatedInvoice.notes,
          }
        : null,
      videoCount,
      finance,
      payment: {
        id: payment.id,
        paymentNumber,
        amount: currentAmount,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
        method: payment.method,
        methodLabel,
        methodMetaRows,
        reference: payment.reference,
        notes: payment.notes,
        verification: payment.verification,
        receiptStatus,
        receiptStatusLabel,
        invoiceId: payment.invoiceId,
        invoiceNumber: payment.invoice?.invoiceNumber || null,
        recordedByName: recordedBy?.fullName || null,
      },
      generatedAt: new Date().toISOString(),
    };
  },

  /** Printable HTML receipt (print / Save as PDF). */
  async getPaymentReceiptHtml(paymentId, auth) {
    const receipt = await this.getPaymentReceipt(paymentId, auth);
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
        crmCustomer: {
          select: { id: true, personName: true, companyName: true },
        },
      },
    });
    if (!payment) throw new AppError("پرداخت یافت نشد", 404, "NOT_FOUND");
    if (payment.verification === "VERIFIED") {
      return { ...payment, approvalStatus: "APPROVED" };
    }
    if (payment.verification === "REJECTED") {
      throw new AppError(
        "پرداخت رد‌شده قابل تأیید نیست",
        400,
        "PAYMENT_REJECTED",
      );
    }

    const approvedAt = new Date();
    let customerConverted = false;

    const result = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.update({
        where: { id: paymentId },
        data: {
          verification: "VERIFIED",
          verifiedAt: approvedAt,
          verifiedById: auth.userId,
          rejectedAt: null,
          rejectedById: null,
          rejectionReason: null,
        },
      });

      if (payment.invoiceId) {
        const verifiedSum = await tx.payment.aggregate({
          where: { invoiceId: payment.invoiceId, verification: "VERIFIED" },
          _sum: { amount: true },
        });
        const received = Number(verifiedSum._sum.amount || 0);
        const total = Number(payment.invoice.total);
        let status = "ISSUED";
        if (received <= 0) status = "ISSUED";
        else if (received < total) status = "PARTIALLY_PAID";
        else status = "PAID";

        await tx.invoice.update({
          where: { id: payment.invoiceId },
          data: { status },
        });
      }

      let finance = null;
      if (payment.invoice?.opportunityId) {
        finance = (
          await syncOpportunityFinance(tx, payment.invoice.opportunityId, {
            persist: true,
          })
        ).finance;
      } else if (payment.invoice?.projectId) {
        finance =
          (
            await syncProjectFinanceFromPayments(
              tx,
              payment.invoice.projectId,
              {
                persist: true,
              },
            )
          )?.finance || null;
      } else {
        const synced = await syncCustomerOpportunitiesFinance(
          tx,
          payment.crmCustomerId,
        );
        finance = synced[0]?.finance || null;
      }

      if (payment.recordedById && payment.recordedById !== auth.userId) {
        const ctx = await resolvePaymentContext(tx, payment);
        await createNotificationOnce(
          {
            userId: payment.recordedById,
            audience: "INTERNAL",
            ...buildPaymentApprovedNotification({
              paymentId,
              amount: payment.amount,
              method: payment.method,
              projectTitle: ctx.projectTitle,
              projectId: ctx.projectId,
              crmCustomerId: payment.crmCustomerId,
              approvedAt,
            }),
          },
          tx,
        );
      }

      await applyCrmEvent(tx, {
        customerId: payment.crmCustomerId,
        opportunityId: payment.invoice?.opportunityId || null,
        event: CRM_EVENTS.PAYMENT_CONFIRMED,
        actorId: auth.userId,
        actorType: "USER",
        source: "PAYMENT",
        relatedType: "Payment",
        relatedId: paymentId,
        title: "بیعانه تأیید شد",
      });

      const conversion = await maybeAutoConvertAfterFirstVerifiedPayment(tx, {
        customerId: payment.crmCustomerId,
        actorId: auth.userId,
        paymentId,
        trigger: "verify",
      });
      customerConverted = conversion.converted === true;

      return { payment: p, finance };
    });

    await writeAudit({
      userId: auth.userId,
      action: "PAYMENT_VERIFY",
      entityType: "Payment",
      entityId: paymentId,
      after: {
        verification: "VERIFIED",
        method: payment.method,
        finance: result.finance,
        customerConverted,
      },
      req,
    });

    let projectAutoCompleted = false;
    try {
      const ctx = await resolvePaymentContext(prisma, payment);
      if (ctx.projectId) {
        await syncProjectFinanceFromPayments(prisma, ctx.projectId, {
          persist: true,
        });
        const { tryAutoCompleteProject } = await import(
          "../../services/projectCompletion.js"
        );
        const auto = await tryAutoCompleteProject(prisma, ctx.projectId, {
          timelineType: "PROJECT_COMPLETED",
          timelineTitle: "تسویه پرداخت و تأیید نهایی — پروژه تکمیل شد",
          timelineBody:
            "پرداخت کامل تأیید شد و محصول نهایی قبلاً توسط مشتری تأیید شده بود",
          notifyProgress: true,
          actorId: auth.userId,
        });
        projectAutoCompleted =
          auto.completed === true && auto.alreadyCompleted !== true;
      }
    } catch (err) {
      console.error(
        "[completion] auto-complete after payment verify",
        err?.message || err,
      );
    }

    return {
      ...result.payment,
      methodLabel: formatPaymentMethod(result.payment.method),
      finance: result.finance,
      approvalStatus: "APPROVED",
      customerConverted,
      projectAutoCompleted,
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
    if (!opp) throw new AppError("فرصت یافت نشد", 404, "NOT_FOUND");

    const phoneOk = !!(
      opp.crmCustomer.phone?.trim() || opp.crmCustomer.normalizedWhatsapp
    );

    const verifiedCount = await prisma.payment.count({
      where: { crmCustomerId: opp.crmCustomerId, verification: "VERIFIED" },
    });
    const hasVerifiedPayment = verifiedCount > 0;
    const converted = Boolean(opp.crmCustomer.convertedAt);
    const stage = canonicalizeStage(opp.crmCustomer.pipelineStage);
    const depositConfirmed =
      converted ||
      [
        "DEPOSIT_CONFIRMED",
        "PORTAL_INVITED",
        "PROJECT_CREATED",
        "DELIVERED",
        "REPEAT_CUSTOMER",
      ].includes(stage);

    const eligible = phoneOk && hasVerifiedPayment && converted;

    return {
      eligible,
      opportunityId: opp.id,
      crmCustomerId: opp.crmCustomerId,
      hasExistingPortal: !!opp.crmCustomer.portalAccount,
      gates: {
        hasPhone: phoneOk,
        hasFirstPayment: hasVerifiedPayment,
        depositConfirmed,
        converted,
      },
    };
  },

  async createPortalInvite(opportunityId, auth, req) {
    const eligibility = await this.getInviteEligibility(opportunityId);
    if (!eligibility.eligible) {
      let message = "دعوت پورتال پس از تأیید بیعانه و ایجاد مشتری فعال می‌شود";
      if (eligibility.gates?.hasFirstPayment && !eligibility.gates?.hasPhone) {
        message = "برای دعوت پورتال، شماره تماس مشتری الزامی است";
      } else if (!eligibility.gates?.hasFirstPayment) {
        message = "دعوت پورتال پس از تأیید اولین پرداخت مشتری فعال می‌شود";
      } else if (!eligibility.gates?.depositConfirmed) {
        message = "ابتدا بیعانه باید تأیید شود و مشتری ایجاد گردد";
      }
      throw new AppError(message, 403, "INVITE_NOT_ELIGIBLE", {
        gates: eligibility.gates,
      });
    }

    const opp = await prisma.opportunity.findFirst({
      where: { id: opportunityId, deletedAt: null },
      include: {
        crmCustomer: { include: { portalAccount: true } },
      },
    });
    if (!opp) throw new AppError("فرصت یافت نشد", 404, "NOT_FOUND");

    // One customer → one portal account. Never issue a second invite once an account exists.
    if (opp.crmCustomer.portalAccount) {
      return {
        alreadyHasPortal: true,
        portalAccountId: opp.crmCustomer.portalAccount.id,
        inviteCreated: false,
        message: "این مشتری از قبل حساب پورتال دارد؛ دعوت جدید ایجاد نشد",
      };
    }

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
        data: { portalStatus: "INVITED" },
      });

      await applyCrmEvent(tx, {
        customerId: opp.crmCustomerId,
        opportunityId: opp.id,
        event: CRM_EVENTS.PORTAL_INVITED,
        actorId: auth.userId,
        actorType: "USER",
        source: "PORTAL",
        relatedType: "PortalInvite",
        relatedId: inv.id,
        title: "دعوت پورتال ارسال شد",
      });

      return inv;
    });

    await writeAudit({
      userId: auth.userId,
      action: "PORTAL_INVITE_CREATE",
      entityType: "PortalInvite",
      entityId: invite.id,
      after: { opportunityId, expiresAt: invite.expiresAt },
      req,
    });

    return {
      id: invite.id,
      crmCustomerId: invite.crmCustomerId,
      opportunityId: invite.opportunityId,
      whatsappNumber: invite.whatsappNumber,
      token: invite.token,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
      registerUrl: `${env.webUrl}/portal/register/${invite.token}`,
    };
  },

  async updateOpportunity(opportunityId, data, auth, req) {
    const opp = await prisma.opportunity.findFirst({
      where: { id: opportunityId, deletedAt: null },
    });
    if (!opp) throw new AppError("فرصت یافت نشد", 404, "NOT_FOUND");

    const updated = await prisma.opportunity.update({
      where: { id: opportunityId },
      data: {
        title: data.title ?? undefined,
        proposedPrice:
          data.proposedPrice != null ? Number(data.proposedPrice) : undefined,
        agreedPrice:
          data.agreedPrice != null ? Number(data.agreedPrice) : undefined,
        agreedTerms: data.agreedTerms ?? undefined,
        serviceId: data.serviceId ?? undefined,
      },
    });

    await writeAudit({
      userId: auth.userId,
      action: "OPPORTUNITY_UPDATE",
      entityType: "Opportunity",
      entityId: opportunityId,
      before: { agreedPrice: opp.agreedPrice, agreedTerms: opp.agreedTerms },
      after: {
        agreedPrice: updated.agreedPrice,
        agreedTerms: updated.agreedTerms,
      },
      req,
    });
    return updated;
  },

  async createClientAsset(
    customerId,
    { kind, name, storageKey, mimeType, sizeBytes, meta },
    auth,
    req,
  ) {
    await this.getCustomer(customerId, { auth });
    if (!storageKey || !name)
      throw new AppError("نام و مسیر فایل الزامی است", 400, "VALIDATION");

    const asset = await prisma.clientAsset.create({
      data: {
        crmCustomerId: customerId,
        kind: kind || "OTHER",
        name,
        storageKey,
        mimeType: mimeType || null,
        sizeBytes: sizeBytes != null ? Number(sizeBytes) : null,
        meta: meta || undefined,
      },
    });

    await writeAudit({
      userId: auth.userId,
      action: "CLIENT_ASSET_CREATE",
      entityType: "ClientAsset",
      entityId: asset.id,
      after: { kind: asset.kind, name: asset.name },
      req,
    });

    const { serializePortalAsset } = await import("../portal/helpers.js");
    return serializePortalAsset(asset);
  },

  async listClientAssets(customerId, auth) {
    await this.getCustomer(customerId, { auth });
    const { serializePortalAsset } = await import("../portal/helpers.js");
    const rows = await prisma.clientAsset.findMany({
      where: { crmCustomerId: customerId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => serializePortalAsset(row)).filter(Boolean);
  },

  async softDeleteClientAsset(customerId, assetId, auth, req) {
    await this.getCustomer(customerId, { auth });
    const asset = await prisma.clientAsset.findFirst({
      where: {
        id: assetId,
        crmCustomerId: customerId,
        deletedAt: null,
      },
    });
    if (!asset) throw new AppError("فایل یافت نشد", 404, "NOT_FOUND");

    const updated = await prisma.clientAsset.update({
      where: { id: assetId },
      data: { deletedAt: new Date() },
    });

    await writeAudit({
      userId: auth.userId,
      action: "CLIENT_ASSET_DELETE",
      entityType: "ClientAsset",
      entityId: asset.id,
      before: { kind: asset.kind, name: asset.name },
      req,
    });

    return updated;
  },

  async softDeleteCustomer(id, auth, req) {
    const customer = await this.getCustomer(id, { auth });
    const liveProjects = customer.projects || [];

    if (
      liveProjects.length &&
      auth.roleCode !== "MANAGER" &&
      auth.roleCode !== "ADMIN"
    ) {
      throw new AppError(
        "حذف مشتری دارای پروژه فقط توسط مدیر مجاز است",
        403,
        "FORBIDDEN",
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
        await tx.notification.deleteMany({
          where: { portalAccountId: portal.id },
        });
      }

      const invites = await tx.portalInvite.findMany({
        where: { crmCustomerId: id },
        select: { id: true },
      });
      const inviteIds = invites.map((i) => i.id);
      if (inviteIds.length) {
        await tx.otpCode.deleteMany({
          where: { portalInviteId: { in: inviteIds } },
        });
        await tx.portalInvite.deleteMany({ where: { id: { in: inviteIds } } });
      }

      // Internal notifications pointing at this customer
      await tx.notification.deleteMany({
        where: {
          OR: [
            { link: `/crm/${id}` },
            { link: { startsWith: `/crm/${id}?` } },
            { link: { startsWith: `/crm/${id}/` } },
            { meta: { path: ["customerId"], equals: id } },
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
      const projectInvoiceIds = projects.flatMap((p) =>
        p.invoices.map((inv) => inv.id),
      );

      if (projectInvoiceIds.length) {
        await tx.payment.deleteMany({
          where: { invoiceId: { in: projectInvoiceIds } },
        });
        await tx.invoice.deleteMany({
          where: { id: { in: projectInvoiceIds } },
        });
      }

      if (projectIds.length) {
        await tx.expense.deleteMany({
          where: { projectId: { in: projectIds } },
        });
        await tx.employeePayable.deleteMany({
          where: { projectId: { in: projectIds } },
        });

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
          await tx.payment.deleteMany({
            where: { invoiceId: { in: remainingInvoiceIds } },
          })
        ).count;
        invoicesRemoved += (
          await tx.invoice.deleteMany({
            where: { id: { in: remainingInvoiceIds } },
          })
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
            passwordCipher: null,
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
          portalStatus: "SUSPENDED",
          pipelineStage: "LOST_CANCELED",
          lostReason: "حذف شده از سیستم",
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
      action: "CRM_CUSTOMER_PURGE",
      entityType: "CrmCustomer",
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

  async bulkDeleteCustomers(ids, auth, req) {
    const unique = normalizeBulkCustomerIds(ids);
    if (!unique.length) {
      throw new AppError("حداقل یک مورد را انتخاب کنید", 400, "VALIDATION");
    }
    if (unique.length > 100) {
      throw new AppError(
        "حداکثر ۱۰۰ مورد در هر درخواست قابل حذف است",
        400,
        "VALIDATION",
      );
    }

    const deleted = [];
    const failed = [];

    for (const id of unique) {
      try {
        const result = await this.softDeleteCustomer(id, auth, req);
        deleted.push({ id: result.id });
      } catch (err) {
        failed.push({
          id,
          message:
            err instanceof AppError
              ? err.message
              : "حذف این مورد انجام نشد. لطفاً دوباره تلاش کنید.",
          status: err instanceof AppError ? err.status : 500,
          code: err instanceof AppError ? err.code : "APP_ERROR",
        });
      }
    }

    if (!deleted.length) {
      const first = failed[0];
      throw new AppError(
        first?.message || "حذف انتخاب‌شده‌ها انجام نشد",
        first?.status || 400,
        first?.code || "BULK_DELETE_FAILED",
        { failed: failed.map(({ id, message }) => ({ id, message })) },
      );
    }

    return {
      selected: unique.length,
      deleted,
      failed: failed.map(({ id, message }) => ({ id, message })),
    };
  },

  /**
   * Spec §5.4 — Merge Duplicate: manager/senior sales only; keep projects & timeline on survivor.
   */
  async mergeDuplicates({ survivorId, duplicateId }, auth, req) {
    if (survivorId === duplicateId)
      throw new AppError("شناسه‌ها یکسان هستند", 400, "VALIDATION");
    const [survivor, duplicate] = await Promise.all([
      prisma.crmCustomer.findFirst({
        where: { id: survivorId, deletedAt: null },
      }),
      prisma.crmCustomer.findFirst({
        where: { id: duplicateId, deletedAt: null },
        include: { portalAccount: true },
      }),
    ]);
    if (!survivor || !duplicate)
      throw new AppError("مشتری یافت نشد", 404, "NOT_FOUND");

    const survivorPortal = await prisma.portalAccount.findFirst({
      where: { crmCustomerId: survivorId, deletedAt: null },
    });
    if (duplicate.portalAccount && survivorPortal) {
      throw new AppError(
        "هر دو مشتری حساب پورتال دارند؛ ادغام دستی نیاز است",
        409,
        "PORTAL_CONFLICT",
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.opportunity.updateMany({
        where: { crmCustomerId: duplicateId },
        data: { crmCustomerId: survivorId },
      });
      await tx.clientAsset.updateMany({
        where: { crmCustomerId: duplicateId },
        data: { crmCustomerId: survivorId },
      });
      await tx.project.updateMany({
        where: { crmCustomerId: duplicateId },
        data: { crmCustomerId: survivorId },
      });
      await tx.invoice.updateMany({
        where: { crmCustomerId: duplicateId },
        data: { crmCustomerId: survivorId },
      });
      await tx.payment.updateMany({
        where: { crmCustomerId: duplicateId },
        data: { crmCustomerId: survivorId },
      });
      await tx.portalInvite.updateMany({
        where: { crmCustomerId: duplicateId },
        data: { crmCustomerId: survivorId },
      });
      await tx.crmActivity.updateMany({
        where: { crmCustomerId: duplicateId },
        data: { crmCustomerId: survivorId },
      });
      await tx.contactMessage.updateMany({
        where: { crmCustomerId: duplicateId },
        data: { crmCustomerId: survivorId },
      });

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
      action: "CRM_MERGE_DUPLICATE",
      entityType: "CrmCustomer",
      entityId: survivorId,
      before: { duplicateId },
      after: { survivorId },
      req,
    });

    return this.getCustomer(survivorId, { auth });
  },

  checkDuplicate(whatsapp) {
    const lookupKeys = getWhatsappLookupKeys(whatsapp);
    const normalized = normalizeWhatsapp(whatsapp);
    return prisma.crmCustomer
      .findFirst({
        where: { normalizedWhatsapp: { in: lookupKeys }, deletedAt: null },
        select: {
          id: true,
          personName: true,
          companyName: true,
          customerCode: true,
        },
      })
      .then((found) => ({ normalized, exists: !!found, customer: found }));
  },

  async getActivity(customerId, auth) {
    await this.getCustomer(customerId, { auth });
    return { items: await listCrmActivities(prisma, customerId) };
  },

  async addInteraction(customerId, { type, body }, auth, req) {
    await this.getCustomer(customerId, { auth });
    const event = type === "NOTE" ? null : CRM_EVENTS.INTERACTION;
    await prisma.$transaction(async (tx) => {
      if (type === "NOTE") {
        await recordCrmActivity(tx, {
          crmCustomerId: customerId,
          type: ACTIVITY_TYPES.NOTE,
          title: "یادداشت",
          body,
          actorId: auth.userId,
          actorType: "USER",
          source: "CRM",
        });
        await tx.crmCustomer.update({
          where: { id: customerId },
          data: { lastContactAt: new Date() },
        });
        return;
      }
      const mappedEvent =
        type === "INFORMATION_SENT"
          ? CRM_EVENTS.INFORMATION_SENT
          : type === "PROPOSAL_SENT" || type === "PRICE_SENT"
            ? CRM_EVENTS.PROPOSAL_SENT
            : type === "WAITING_DECISION"
              ? CRM_EVENTS.WAITING_DECISION
              : CRM_EVENTS.INTERACTION;
      await applyCrmEvent(tx, {
        customerId,
        event: mappedEvent,
        actorId: auth.userId,
        actorType: "USER",
        source: "CRM",
        interactionType: type,
        body,
        note: body,
        title:
          type === "INFORMATION_SENT"
            ? "اطلاعات ارسال شد"
            : type === "PROPOSAL_SENT" || type === "PRICE_SENT"
              ? "پیشنهاد / قیمت ارسال شد"
              : type === "WAITING_DECISION"
                ? "در انتظار تصمیم"
                : "تعامل ثبت شد",
      });
    });
    await writeAudit({
      userId: auth.userId,
      action: "CRM_INTERACTION",
      entityType: "CrmCustomer",
      entityId: customerId,
      after: { type, event },
      req,
    });
    return this.getCustomer(customerId, { auth });
  },

  async changeStage(customerId, { stage }, auth, req) {
    const before = await this.getCustomer(customerId, { auth });
    const current = canonicalizeStage(before.pipelineStage);
    const next = canonicalizeStage(stage);
    if (current === next && next !== "REPEAT_CUSTOMER") {
      return before;
    }
    if (!canManuallySetStage(auth, next, current)) {
      throw new AppError("اجازه تغییر به این وضعیت را ندارید", 403, "FORBIDDEN");
    }

    if (next === "REPEAT_CUSTOMER") {
      return this.startRepeatCustomerCycle(customerId, auth, req);
    }

    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.crmCustomer.findFirst({
        where: { id: customerId, deletedAt: null },
      });
      if (!customer) throw new AppError("مشتری یافت نشد", 404, "NOT_FOUND");
      const activeOpportunity = await this.ensureOpenOpportunity(tx, customer);
      return applyCrmEvent(tx, {
        customerId,
        opportunityId: activeOpportunity.id,
        event: next === "LOST_CANCELED" ? CRM_EVENTS.LOST : CRM_EVENTS.MANUAL_STAGE,
        targetStage: next,
        force: true,
        actorId: auth.userId,
        actorType: "USER",
        source: "MANUAL",
        title: "تغییر دستی وضعیت",
      });
    });
    if (!result?.changed) {
      throw new AppError(
        "این تغییر وضعیت بر اساس قوانین قیف فروش مجاز نیست",
        403,
        "INVALID_TRANSITION",
      );
    }
    await writeAudit({
      userId: auth.userId,
      action: "CRM_STAGE_CHANGE",
      entityType: "CrmCustomer",
      entityId: customerId,
      after: { stage: next, previousStage: current },
      req,
    });
    return this.getCustomer(customerId, { auth });
  },

  /**
   * Activate Repeat Customer: same CrmCustomer + portal, new blank Opportunity.
   * Never mutates prior opportunities, contracts, payments, or portal accounts.
   */
  async startRepeatCustomerCycle(customerId, auth, req) {
    const customer = await prisma.crmCustomer.findFirst({
      where: { id: customerId, deletedAt: null },
      include: { portalAccount: { select: { id: true } } },
    });
    if (!customer) throw new AppError("مشتری یافت نشد", 404, "NOT_FOUND");

    const current = canonicalizeStage(customer.pipelineStage);

    const profile = snapshotCustomerProfile(customer);

    const cycle = await prisma.$transaction(async (tx) => {
      const { opportunity, created } = await openFreshCycleOpportunity(tx, customer, {
        pipelineStage: "REPEAT_CUSTOMER",
        title: `سفارش جدید — ${getCustomerPersonName(customer)}`,
        alwaysCreate: true,
      });

      if (current !== "REPEAT_CUSTOMER") {
        const stageResult = await applyCrmEvent(tx, {
          customerId,
          opportunityId: opportunity.id,
          event: CRM_EVENTS.MANUAL_STAGE,
          targetStage: "REPEAT_CUSTOMER",
          force: true,
          actorId: auth.userId,
          actorType: "USER",
          source: "MANUAL",
          note: "ایجاد پروژه/سفارش جدید برای مشتری موجود",
          title: "فعال‌سازی مشتری تکراری",
          relatedType: "Opportunity",
          relatedId: opportunity.id,
          meta: {
            repeatCycle: true,
            opportunityCreated: created,
            profile,
            portalInviteCreated: false,
          },
          touchLastContact: true,
        });
        if (!stageResult?.changed) {
          throw new AppError(
            "فعال‌سازی مشتری تکراری انجام نشد",
            403,
            "INVALID_TRANSITION",
          );
        }
      } else {
        await applyCrmEvent(tx, {
          customerId,
          opportunityId: opportunity.id,
          event: CRM_EVENTS.REPEAT_ORDER,
          actorId: auth.userId,
          actorType: "USER",
          source: "MANUAL",
          note: "پروژه/سفارش جدید تحت همان مشتری",
          title: "سفارش جدید برای مشتری تکراری",
          relatedType: "Opportunity",
          relatedId: opportunity.id,
          meta: {
            repeatCycle: true,
            opportunityCreated: created,
            profile,
            portalInviteCreated: false,
          },
          touchLastContact: true,
        });
      }

      return { opportunity, created };
    });

    await writeAudit({
      userId: auth.userId,
      action: "CRM_REPEAT_CYCLE_START",
      entityType: "CrmCustomer",
      entityId: customerId,
      after: {
        previousStage: current,
        stage: "REPEAT_CUSTOMER",
        opportunityId: cycle.opportunity.id,
        opportunityCreated: cycle.created,
        portalInviteCreated: false,
        hasPortalAccount: Boolean(customer.portalAccount),
        profile,
      },
      req,
    });

    const view = await this.getCustomer(customerId, { auth });
    return {
      ...view,
      repeatCycle: {
        opportunityId: cycle.opportunity.id,
        opportunityCreated: cycle.created,
        portalInviteCreated: false,
        hasPortalAccount: Boolean(customer.portalAccount),
        profile,
      },
    };
  },

  async convertCustomer(customerId, auth, req) {
    const result = await this.transferOne(customerId, auth, req);
    if (result.outcome === "already_transferred") {
      return result.customer;
    }
    if (result.outcome === "transferred") {
      return result.customer;
    }
    throw new AppError(
      result.message || "انتقال مشتری انجام نشد",
      result.status || 403,
      result.code || "CONVERT_NOT_ELIGIBLE",
    );
  },

  async transferCustomers(ids, auth, req) {
    const unique = [
      ...new Set(
        (ids || []).map((id) => String(id || "").trim()).filter(Boolean),
      ),
    ];
    if (!unique.length) {
      throw new AppError("حداقل یک سرنخ را انتخاب کنید", 400, "VALIDATION");
    }

    const transferred = [];
    const alreadyTransferred = [];
    const skipped = [];
    const failed = [];

    for (const id of unique) {
      try {
        const result = await this.transferOne(id, auth, req);
        const item = {
          id,
          personName: result.customer?.personName || result.personName || null,
          customerCode:
            result.customer?.customerCode || result.customerCode || null,
        };
        if (result.outcome === "transferred") transferred.push(item);
        else if (result.outcome === "already_transferred")
          alreadyTransferred.push(item);
        else if (result.outcome === "skipped") {
          skipped.push({ ...item, reason: result.message });
        } else {
          failed.push({
            ...item,
            message: result.message || "انتقال ناموفق بود",
          });
        }
      } catch (err) {
        failed.push({
          id,
          personName: null,
          customerCode: null,
          message:
            err instanceof AppError
              ? err.message
              : "انتقال مشتری انجام نشد. لطفاً دوباره تلاش کنید.",
        });
      }
    }

    return {
      selected: unique.length,
      transferred,
      alreadyTransferred,
      skipped,
      failed,
    };
  },

  async transferOne(customerId, auth, req) {
    const row = await prisma.crmCustomer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: {
        id: true,
        personName: true,
        companyName: true,
        customerCode: true,
        convertedAt: true,
        pipelineStage: true,
        salesOwnerId: true,
        normalizedWhatsapp: true,
        email: true,
      },
    });
    if (!row) {
      return {
        outcome: "failed",
        id: customerId,
        message: "سرنخ یافت نشد",
        status: 404,
        code: "NOT_FOUND",
      };
    }
    if (
      auth?.roleCode === "SALES" &&
      row.salesOwnerId &&
      row.salesOwnerId !== auth.userId
    ) {
      return {
        outcome: "failed",
        id: customerId,
        personName: row.personName,
        customerCode: row.customerCode,
        message: "اجازه انتقال این سرنخ را ندارید",
        status: 403,
        code: "FORBIDDEN",
      };
    }
    if (row.convertedAt) {
      return {
        outcome: "already_transferred",
        customer: await this.getCustomer(customerId, { auth }),
      };
    }
    const stage = canonicalizeStage(row.pipelineStage);
    if (stage === "DELIVERED") {
      return {
        outcome: "skipped",
        id: customerId,
        personName: row.personName,
        customerCode: row.customerCode,
        message: "این مشتری قبلاً تحویل شده است",
        status: 403,
        code: "LEAD_DELIVERED",
      };
    }
    if (isClosedStage(stage)) {
      return {
        outcome: "skipped",
        id: customerId,
        personName: row.personName,
        customerCode: row.customerCode,
        message: "این مشتری لغو شده است",
        status: 403,
        code: "LEAD_CLOSED",
      };
    }

    const duplicate = await prisma.crmCustomer.findFirst({
      where: {
        id: { not: customerId },
        deletedAt: null,
        convertedAt: { not: null },
        OR: [
          { normalizedWhatsapp: row.normalizedWhatsapp },
          ...(row.email ? [{ email: row.email }] : []),
        ],
      },
      select: { id: true, customerCode: true, personName: true },
    });
    if (duplicate) {
      return {
        outcome: "skipped",
        id: customerId,
        personName: row.personName,
        customerCode: row.customerCode,
        message: `این مشتری قبلاً با شناسه ${duplicate.customerCode || duplicate.id} در مدیریت مشتریان ثبت شده است`,
        status: 409,
        code: "DUPLICATE_CUSTOMER",
      };
    }

    await prisma.$transaction(async (tx) => {
      await applyCrmEvent(tx, {
        customerId,
        event: CRM_EVENTS.CUSTOMER_CONVERTED,
        actorId: auth.userId,
        actorType: "USER",
        source: "CRM",
        title: "انتقال به مدیریت مشتریان",
        note: "مشتری از CRM و فروش به مدیریت مشتریان منتقل شد",
        notify: false,
      });
    });

    const actorName = auth?.user?.fullName || null;
    await notifyManagersOnce(
      buildCustomerConvertedNotification({
        customerId,
        personName: row.personName,
        customerCode: row.customerCode,
        companyName: row.companyName,
        actorName,
        transferredAt: new Date(),
      }),
    );

    await writeAudit({
      userId: auth.userId,
      action: "CRM_CUSTOMER_CONVERT",
      entityType: "CrmCustomer",
      entityId: customerId,
      after: { customerCode: row.customerCode, transferred: true },
      req,
    });

    return {
      outcome: "transferred",
      customer: await this.getCustomer(customerId, { auth }),
    };
  },

  async ingestWhatsApp(body, auth, req) {
    const result = await ingestWhatsAppMessage(body);
    await writeAudit({
      userId: auth?.userId,
      action: result.created
        ? "CRM_WHATSAPP_LEAD_CREATE"
        : "CRM_WHATSAPP_INTERACTION",
      entityType: "CrmCustomer",
      entityId: result.customer.id,
      after: { source: "WHATSAPP", created: result.created },
      req,
    });
    return {
      created: result.created,
      duplicate: result.duplicate,
      customerId: result.customer.id,
      customerCode: result.customer.customerCode,
    };
  },
};
