import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/response.js";
import { writeAudit } from "../../middleware/audit.js";
import {
  notifyManagersOnce,
  buildContactMessageNotification,
} from "../../services/notifications.js";
import { buildWhatsappCta, getWhatsappNumber } from "../../services/whatsapp.js";
import {
  formatE164Display,
  parseInternationalPhone,
  whatsappDigitsForLink,
  WHATSAPP_VALIDATION_MESSAGE,
} from "../../utils/whatsappNormalize.js";
import { withContactVisibility } from "./visibility.js";
import { formatCustomerNameWithCompany } from "../../utils/crmCustomerName.js";
import {
  ingestWebsiteContact,
  ingestWhatsAppWebsiteLead,
} from "../crm/ingestion.js";

export const CONTACT_SUBJECTS = [
  { value: "GENERAL", label: "درخواست عمومی" },
  { value: "CONSULTATION", label: "مشاوره پروژه" },
  { value: "QUOTE", label: "درخواست قیمت" },
  { value: "COLLABORATION", label: "همکاری" },
  { value: "SUPPORT", label: "پشتیبانی" },
  { value: "OTHER", label: "سایر" },
];

/** Stored when the public form no longer collects a subject. */
export const DEFAULT_CONTACT_SUBJECT = "GENERAL";

const SUBJECT_LABELS = Object.fromEntries(
  CONTACT_SUBJECTS.map((s) => [s.value, s.label]),
);

const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

function sanitizeText(value, max) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function sanitizeMultiline(value, max) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
    .slice(0, max);
}

function phoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

export const submitContactSchema = z.object({
  name: z
    .string({ required_error: "نام الزامی است" })
    .trim()
    .min(2, "نام باید حداقل ۲ حرف باشد")
    .max(80, "نام نباید بیشتر از ۸۰ حرف باشد"),
  email: z
    .string({ required_error: "ایمیل الزامی است" })
    .trim()
    .min(1, "ایمیل الزامی است")
    .email("ایمیل معتبر وارد کنید")
    .max(160, "ایمیل بیش از حد طولانی است"),
  phone: z
    .string({ required_error: "شماره تماس الزامی است" })
    .trim()
    .min(1, "شماره تماس الزامی است")
    .refine((value) => {
      try {
        parseInternationalPhone(value);
        return true;
      } catch {
        return false;
      }
    }, WHATSAPP_VALIDATION_MESSAGE),
  company: z
    .string()
    .trim()
    .max(120, "نام شرکت بیش از حد طولانی است")
    .optional()
    .or(z.literal("")),
  // Optional for backward compatibility; public form no longer sends subject.
  subject: z
    .enum(["GENERAL", "CONSULTATION", "QUOTE", "COLLABORATION", "SUPPORT", "OTHER"])
    .optional(),
  message: z
    .string({ required_error: "پیام الزامی است" })
    .trim()
    .min(10, "پیام باید حداقل ۱۰ حرف باشد")
    .max(2000, "پیام نباید بیشتر از ۲۰۰۰ حرف باشد"),
});

/** Public WhatsApp floating CTA — lead form before opening wa.me */
export const submitWhatsAppLeadSchema = z.object({
  name: z
    .string({ required_error: "نام الزامی است" })
    .trim()
    .min(2, "نام باید حداقل ۲ حرف باشد")
    .max(80, "نام نباید بیشتر از ۸۰ حرف باشد"),
  whatsapp: z
    .string({ required_error: "شماره واتساپ الزامی است" })
    .trim()
    .min(1, "شماره واتساپ الزامی است")
    .refine((value) => {
      try {
        parseInternationalPhone(value);
        return true;
      } catch {
        return false;
      }
    }, WHATSAPP_VALIDATION_MESSAGE),
  companyName: z
    .string({ required_error: "نام شرکت الزامی است" })
    .trim()
    .min(2, "نام شرکت باید حداقل ۲ حرف باشد")
    .max(120, "نام شرکت بیش از حد طولانی است"),
  jobTitle: z
    .string({ required_error: "موقف الزامی است" })
    .trim()
    .min(2, "موقف باید حداقل ۲ حرف باشد")
    .max(120, "موقف بیش از حد طولانی است"),
});

function settingString(value, keys) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of keys) {
      const next = value[key];
      if (typeof next === "string" && next.trim()) return next.trim();
    }
  }
  return "";
}

function formatPhoneDisplay(raw) {
  return formatE164Display(raw);
}

function telHref(raw) {
  const digits = whatsappDigitsForLink(raw) || phoneDigits(raw);
  if (!digits) return "";
  return `tel:+${digits.replace(/^\+/, "")}`;
}

export function subjectLabel(code) {
  return SUBJECT_LABELS[code] || code || "—";
}

function serialize(row) {
  if (!row) return null;
  const customer = row.crmCustomer;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company || null,
    subject: row.subject,
    subjectLabel: subjectLabel(row.subject),
    message: row.message,
    isRead: row.isRead,
    readAt: row.readAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    crmCustomerId: row.crmCustomerId || null,
    crmCustomer: customer
      ? {
          id: customer.id,
          customerCode: customer.customerCode || null,
          displayName: formatCustomerNameWithCompany(customer),
        }
      : null,
  };
}

const contactInclude = {
  crmCustomer: {
    select: {
      id: true,
      customerCode: true,
      personName: true,
      companyName: true,
      salesOwnerId: true,
    },
  },
};

async function findAccessibleMessage(id, auth) {
  const row = await prisma.contactMessage.findFirst({
    where: withContactVisibility({ id, deletedAt: null }, auth),
    include: contactInclude,
  });
  if (!row) throw new AppError("پیام یافت نشد", 404, "NOT_FOUND");
  return row;
}

function previewOf(message, max = 140) {
  const text = String(message || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function serializeListItem(row) {
  return {
    ...serialize(row),
    messagePreview: previewOf(row.message),
  };
}

export const contactService = {
  async getPublicContactInfo() {
    const [whatsappNumber, emailSetting, phoneSetting, whatsappCta] =
      await Promise.all([
        getWhatsappNumber(),
        prisma.setting.findUnique({ where: { key: "contact_email" } }),
        prisma.setting.findUnique({ where: { key: "contact_phone" } }),
        buildWhatsappCta({ fromPublicWebsite: true }),
      ]);

    const email =
      settingString(emailSetting?.value, ["email", "address", "value"]) ||
      env.contactEmail;
    const phone =
      settingString(phoneSetting?.value, ["number", "phone", "value"]) ||
      env.contactPhone ||
      whatsappNumber;

    return {
      whatsapp: {
        id: "whatsapp",
        label: "واتساپ",
        value: formatPhoneDisplay(whatsappNumber),
        href: whatsappCta.url || "",
      },
      phone: {
        id: "phone",
        label: "تلفن",
        value: formatPhoneDisplay(phone),
        href: telHref(phone),
      },
      email: {
        id: "email",
        label: "ایمیل",
        value: email,
        href: email ? `mailto:${email}` : "",
      },
    };
  },

  async submit(raw, req) {
    const name = sanitizeText(raw.name, 80);
    const email = sanitizeText(raw.email, 160).toLowerCase();
    const phoneRaw = sanitizeText(raw.phone, 40);
    const company = sanitizeText(raw.company || "", 120) || null;
    const subject =
      SUBJECT_LABELS[raw.subject] != null
        ? raw.subject
        : DEFAULT_CONTACT_SUBJECT;
    const message = sanitizeMultiline(raw.message, 2000);

    let parsedPhone;
    try {
      parsedPhone = parseInternationalPhone(phoneRaw);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(WHATSAPP_VALIDATION_MESSAGE, 400, "INVALID_PHONE");
    }
    const phone = parsedPhone.e164;

    const since = new Date(Date.now() - DUPLICATE_WINDOW_MS);
    const duplicate = await prisma.contactMessage.findFirst({
      where: {
        email,
        message,
        deletedAt: null,
        createdAt: { gte: since },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new AppError(
        "این پیام به‌تازگی ارسال شده است. لطفاً کمی صبر کنید.",
        409,
        "DUPLICATE_SUBMISSION",
      );
    }

    // Lead must be persisted before we acknowledge success to the visitor.
    let ingested;
    try {
      ingested = await ingestWebsiteContact({
        name,
        email,
        phone,
        company,
        subject: subjectLabel(subject),
        message,
      });
    } catch (err) {
      console.error("[contact] CRM lead ingest failed", err?.message || err);
      if (err instanceof AppError) throw err;
      throw new AppError(
        "ثبت سرنخ در سیستم فروش ناموفق بود. لطفاً دوباره تلاش کنید.",
        500,
        "LEAD_CREATE_FAILED",
      );
    }

    const crmCustomerId = ingested?.customer?.id || null;
    if (!crmCustomerId) {
      throw new AppError(
        "ثبت سرنخ در سیستم فروش ناموفق بود. لطفاً دوباره تلاش کنید.",
        500,
        "LEAD_CREATE_FAILED",
      );
    }

    const row = await prisma.contactMessage.create({
      data: {
        name,
        email,
        phone,
        company,
        subject,
        message,
        isRead: false,
        ipAddress: req?.ip || null,
        userAgent: String(req?.get?.("user-agent") || "").slice(0, 300) || null,
        crmCustomerId,
      },
    });

    await notifyManagersOnce(
      buildContactMessageNotification({
        messageId: row.id,
        name: row.name,
        subject: subjectLabel(row.subject),
        createdAt: row.createdAt,
      }),
    );

    return {
      id: row.id,
      crmCustomerId,
      leadCreated: Boolean(ingested?.created),
      leadDuplicate: Boolean(ingested?.duplicate),
      leadReopened: Boolean(ingested?.reopened),
    };
  },

  /**
   * Public WhatsApp FAB: create CRM lead first, then return the business wa.me URL.
   * WhatsApp must only open on the client after this succeeds.
   */
  async submitWhatsAppLead(raw, req) {
    const name = sanitizeText(raw.name, 80);
    const whatsappRaw = sanitizeText(raw.whatsapp, 40);
    const companyName = sanitizeText(raw.companyName, 120);
    const jobTitle = sanitizeText(raw.jobTitle, 120);

    let parsedPhone;
    try {
      parsedPhone = parseInternationalPhone(whatsappRaw);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(WHATSAPP_VALIDATION_MESSAGE, 400, "INVALID_WHATSAPP");
    }

    const intro = [
      `سلام، من ${name}`,
      companyName ? `از ${companyName}` : null,
      jobTitle ? `(${jobTitle})` : null,
      "هستم. می‌خواهم درباره خدمات اپیکس معلومات بگیرم.",
    ]
      .filter(Boolean)
      .join(" ");

    let ingested;
    try {
      ingested = await ingestWhatsAppWebsiteLead({
        name,
        whatsapp: parsedPhone.e164,
        companyName,
        jobTitle,
        message: intro,
      });
    } catch (err) {
      console.error(
        "[whatsapp-lead] CRM lead ingest failed",
        err?.message || err,
      );
      if (err instanceof AppError) throw err;
      throw new AppError(
        "ثبت سرنخ در سیستم فروش ناموفق بود. لطفاً دوباره تلاش کنید.",
        500,
        "LEAD_CREATE_FAILED",
      );
    }

    const crmCustomerId = ingested?.customer?.id || null;
    if (!crmCustomerId) {
      throw new AppError(
        "ثبت سرنخ در سیستم فروش ناموفق بود. لطفاً دوباره تلاش کنید.",
        500,
        "LEAD_CREATE_FAILED",
      );
    }

    const cta = await buildWhatsappCta({
      message: intro,
      fromPublicWebsite: true,
    });
    if (!cta?.url) {
      throw new AppError(
        "لینک واتساپ در حال حاضر در دسترس نیست. لطفاً بعداً تلاش کنید.",
        503,
        "WHATSAPP_UNAVAILABLE",
      );
    }

    await writeAudit({
      userId: null,
      action: ingested?.created
        ? "PUBLIC_WHATSAPP_LEAD_CREATE"
        : "PUBLIC_WHATSAPP_LEAD_MATCH",
      entityType: "CrmCustomer",
      entityId: crmCustomerId,
      after: {
        source: "WHATSAPP_WEBSITE",
        channel: "public_whatsapp_cta",
        created: Boolean(ingested?.created),
        duplicate: Boolean(ingested?.duplicate),
        reopened: Boolean(ingested?.reopened),
        customerCode: ingested?.customer?.customerCode || null,
      },
      req,
    });

    return {
      crmCustomerId,
      customerCode: ingested?.customer?.customerCode || null,
      leadCreated: Boolean(ingested?.created),
      leadDuplicate: Boolean(ingested?.duplicate),
      leadReopened: Boolean(ingested?.reopened),
      whatsappUrl: cta.url,
    };
  },

  async list({
    q,
    status,
    page = 1,
    pageSize = 20,
    sort = "newest",
    subject,
    auth,
  } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeSize = Math.min(50, Math.max(1, Number(pageSize) || 20));
    const where = { deletedAt: null };

    if (status === "UNREAD") where.isRead = false;
    if (status === "READ") where.isRead = true;

    const query = String(q || "").trim();
    if (query) {
      const matchingSubjects = CONTACT_SUBJECTS.filter(
        (s) =>
          s.label.includes(query) ||
          s.value.toLowerCase().includes(query.toLowerCase()),
      ).map((s) => s.value);

      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { phone: { contains: query, mode: "insensitive" } },
        { company: { contains: query, mode: "insensitive" } },
        { subject: { contains: query, mode: "insensitive" } },
        { message: { contains: query, mode: "insensitive" } },
        ...(matchingSubjects.length
          ? [{ subject: { in: matchingSubjects } }]
          : []),
      ];
    }

    const subjectKey = String(subject || "").trim();
    if (subjectKey && SUBJECT_LABELS[subjectKey]) {
      where.subject = subjectKey;
    }

    const sortKey = String(sort || "newest");
    const orderBy =
      sortKey === "oldest"
        ? [{ createdAt: "asc" }]
        : sortKey === "name"
          ? [{ name: "asc" }, { createdAt: "desc" }]
          : sortKey === "status"
            ? [{ isRead: "asc" }, { createdAt: "desc" }]
            : [{ createdAt: "desc" }];

    const scopedWhere = withContactVisibility(where, auth);
    const unreadBase = withContactVisibility({ deletedAt: null }, auth);

    const [total, unreadCount, items] = await Promise.all([
      prisma.contactMessage.count({ where: scopedWhere }),
      prisma.contactMessage.count({
        where: { ...unreadBase, isRead: false },
      }),
      prisma.contactMessage.findMany({
        where: scopedWhere,
        include: contactInclude,
        orderBy,
        skip: (safePage - 1) * safeSize,
        take: safeSize,
      }),
    ]);

    return {
      items: items.map(serializeListItem),
      page: safePage,
      pageSize: safeSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeSize)),
      unreadCount,
    };
  },

  async unreadCount(auth) {
    const baseWhere = withContactVisibility({ deletedAt: null }, auth);
    const [unreadCount, total] = await Promise.all([
      prisma.contactMessage.count({
        where: { ...baseWhere, isRead: false },
      }),
      prisma.contactMessage.count({
        where: baseWhere,
      }),
    ]);
    return {
      unreadCount,
      total,
      readCount: Math.max(0, total - unreadCount),
    };
  },

  async getById(id, auth) {
    const row = await findAccessibleMessage(id, auth);
    return serialize(row);
  },

  async markRead(id, auth, req) {
    const existing = await findAccessibleMessage(id, auth);

    if (existing.isRead) return serialize(existing);

    const row = await prisma.contactMessage.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
      include: contactInclude,
    });
    await writeAudit({
      userId: auth?.userId,
      action: "CONTACT_MESSAGE_READ",
      entityType: "ContactMessage",
      entityId: id,
      before: { isRead: false },
      after: { isRead: true },
      req,
    });
    return serialize(row);
  },

  async markUnread(id, auth, req) {
    const existing = await findAccessibleMessage(id, auth);

    if (!existing.isRead) return serialize(existing);

    const row = await prisma.contactMessage.update({
      where: { id },
      data: { isRead: false, readAt: null },
      include: contactInclude,
    });
    await writeAudit({
      userId: auth?.userId,
      action: "CONTACT_MESSAGE_UNREAD",
      entityType: "ContactMessage",
      entityId: id,
      before: { isRead: true },
      after: { isRead: false },
      req,
    });
    return serialize(row);
  },

  async remove(id, auth, req) {
    const existing = await findAccessibleMessage(id, auth);

    await prisma.contactMessage.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await writeAudit({
      userId: auth?.userId,
      action: "CONTACT_MESSAGE_DELETE",
      entityType: "ContactMessage",
      entityId: id,
      before: serialize(existing),
      after: { deletedAt: true },
      req,
    });
    return { deleted: true };
  },
};
