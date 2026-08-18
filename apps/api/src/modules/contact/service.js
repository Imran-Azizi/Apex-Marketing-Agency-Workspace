import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/response.js";
import { writeAudit } from "../../middleware/audit.js";
import {
  notifyManagersOnce,
  buildContactMessageNotification,
} from "../../services/notifications.js";
import { getWhatsappNumber } from "../../services/whatsapp.js";

export const CONTACT_SUBJECTS = [
  { value: "CONSULTATION", label: "مشاوره پروژه" },
  { value: "QUOTE", label: "درخواست قیمت" },
  { value: "COLLABORATION", label: "همکاری" },
  { value: "SUPPORT", label: "پشتیبانی" },
  { value: "OTHER", label: "سایر" },
];

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
      const digits = phoneDigits(value);
      return digits.length >= 8 && digits.length <= 15;
    }, "شماره تماس معتبر وارد کنید"),
  company: z
    .string()
    .trim()
    .max(120, "نام شرکت بیش از حد طولانی است")
    .optional()
    .or(z.literal("")),
  subject: z.enum(["CONSULTATION", "QUOTE", "COLLABORATION", "SUPPORT", "OTHER"], {
    required_error: "موضوع درخواست را انتخاب کنید",
    invalid_type_error: "موضوع درخواست نامعتبر است",
  }),
  message: z
    .string({ required_error: "پیام الزامی است" })
    .trim()
    .min(10, "پیام باید حداقل ۱۰ حرف باشد")
    .max(2000, "پیام نباید بیشتر از ۲۰۰۰ حرف باشد"),
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
  const digits = phoneDigits(raw);
  if (/^07\d{8}$/.test(digits)) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (/^93\d{9}$/.test(digits)) {
    return `+93 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  if (/^\d{10,15}$/.test(digits)) return `+${digits}`;
  return raw || "";
}

function whatsappDigits(raw) {
  let digits = phoneDigits(raw);
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (/^07\d{8}$/.test(digits)) return `93${digits.slice(1)}`;
  if (/^7\d{8}$/.test(digits)) return `93${digits}`;
  return digits;
}

function telHref(raw) {
  const digits = phoneDigits(raw);
  if (!digits) return "";
  if (/^07\d{8}$/.test(digits)) return `tel:+93${digits.slice(1)}`;
  if (/^93\d{9}$/.test(digits)) return `tel:+${digits}`;
  if (digits.startsWith("00")) return `tel:+${digits.slice(2)}`;
  return digits.startsWith("+") ? `tel:${raw}` : `tel:+${digits}`;
}

export function subjectLabel(code) {
  return SUBJECT_LABELS[code] || code || "—";
}

function serialize(row) {
  if (!row) return null;
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
  };
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
    const [whatsappNumber, emailSetting, phoneSetting] = await Promise.all([
      getWhatsappNumber(),
      prisma.setting.findUnique({ where: { key: "contact_email" } }),
      prisma.setting.findUnique({ where: { key: "contact_phone" } }),
    ]);

    const email =
      settingString(emailSetting?.value, ["email", "address", "value"]) ||
      env.contactEmail;
    const phone =
      settingString(phoneSetting?.value, ["number", "phone", "value"]) ||
      env.contactPhone ||
      whatsappNumber;
    const wa = whatsappDigits(whatsappNumber);

    return {
      whatsapp: {
        id: "whatsapp",
        label: "واتساپ",
        value: formatPhoneDisplay(whatsappNumber),
        href: wa
          ? `https://wa.me/${wa}?text=${encodeURIComponent("سلام، می‌خواهم درباره خدمات اپیکس مشاوره بگیرم.")}`
          : "",
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
      subjects: CONTACT_SUBJECTS,
    };
  },

  async submit(raw, req) {
    const name = sanitizeText(raw.name, 80);
    const email = sanitizeText(raw.email, 160).toLowerCase();
    const phone = sanitizeText(raw.phone, 40);
    const company = sanitizeText(raw.company || "", 120) || null;
    const subject = raw.subject;
    const message = sanitizeMultiline(raw.message, 2000);

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

    return { id: row.id };
  },

  async list({
    q,
    status,
    page = 1,
    pageSize = 20,
    sort = "newest",
    subject,
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

    const [total, unreadCount, items] = await Promise.all([
      prisma.contactMessage.count({ where }),
      prisma.contactMessage.count({ where: { deletedAt: null, isRead: false } }),
      prisma.contactMessage.findMany({
        where,
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

  async unreadCount() {
    const [unreadCount, total] = await Promise.all([
      prisma.contactMessage.count({
        where: { deletedAt: null, isRead: false },
      }),
      prisma.contactMessage.count({
        where: { deletedAt: null },
      }),
    ]);
    return {
      unreadCount,
      total,
      readCount: Math.max(0, total - unreadCount),
    };
  },

  async getById(id) {
    const row = await prisma.contactMessage.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) throw new AppError("پیام یافت نشد", 404, "NOT_FOUND");
    return serialize(row);
  },

  async markRead(id, auth, req) {
    const existing = await prisma.contactMessage.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new AppError("پیام یافت نشد", 404, "NOT_FOUND");

    if (existing.isRead) return serialize(existing);

    const row = await prisma.contactMessage.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
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
    const existing = await prisma.contactMessage.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new AppError("پیام یافت نشد", 404, "NOT_FOUND");

    if (!existing.isRead) return serialize(existing);

    const row = await prisma.contactMessage.update({
      where: { id },
      data: { isRead: false, readAt: null },
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
    const existing = await prisma.contactMessage.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new AppError("پیام یافت نشد", 404, "NOT_FOUND");

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
