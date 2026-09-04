import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/response.js";
import { writeAudit } from "../../middleware/audit.js";
import { decryptCredential } from "../../utils/credentialVault.js";
import { hasAnyPermission } from "../../services/permissions/effective.js";

export const INVITE_STATUSES = ["PENDING", "REGISTERED", "EXPIRED", "REVOKED"];

export function inviteStatus(invite, now = new Date()) {
  if (invite?.usedAt) return "REGISTERED";
  if (invite?.revokedAt) return "REVOKED";
  if (invite?.expiresAt && new Date(invite.expiresAt) < now) return "EXPIRED";
  return "PENDING";
}

export function canRevealPortalPassword(auth) {
  return hasAnyPermission(
    auth?.permissions,
    ["crm.portal_credentials"],
    auth?.roleCode,
  );
}

const PORTAL_STATUS_LABELS = {
  NONE: "حساب ایجاد نشده",
  NOT_ELIGIBLE: "حساب ایجاد نشده",
  ELIGIBLE: "آماده دعوت",
  INVITED: "دعوت ارسال شده",
  REGISTERED: "حساب ایجاد شده",
  SUSPENDED: "معلق",
};

function activePortalAccount(customer) {
  const portal = customer?.portalAccount;
  if (!portal || portal.deletedAt) return null;
  return portal;
}

/**
 * Safe portal credential summary for CRM list/detail.
 * Never includes plaintext, hash, or ciphertext.
 */
export function serializePortalCredentials(customer, auth) {
  const portal = activePortalAccount(customer);
  const cipher = portal?.passwordCipher || null;
  const isRegistered = Boolean(
    portal && (portal.registeredAt || customer?.portalStatus === "REGISTERED"),
  );
  const status = portal
    ? customer?.portalStatus || (isRegistered ? "REGISTERED" : "INVITED")
    : customer?.portalStatus && customer.portalStatus !== "REGISTERED"
      ? customer.portalStatus
      : "NONE";
  const reveal = canRevealPortalPassword(auth);

  return {
    exists: Boolean(portal),
    isRegistered,
    isActive: Boolean(portal?.isActive),
    status,
    statusLabel: PORTAL_STATUS_LABELS[status] || PORTAL_STATUS_LABELS.NONE,
    whatsappNumber:
      isRegistered
        ? portal.normalizedWhatsapp || customer?.normalizedWhatsapp || ""
        : null,
    hasPassword: Boolean(cipher),
    canRevealPassword: reveal && Boolean(cipher),
    registeredAt: portal?.registeredAt || null,
    createdAt: portal?.createdAt || null,
  };
}

function inviteCipher(invite) {
  return invite?.passwordCipher || invite?.portalAccount?.passwordCipher || null;
}

function registeredWhatsapp(invite) {
  return (
    invite?.portalAccount?.normalizedWhatsapp ||
    invite?.whatsappNumber ||
    null
  );
}

export function serializePortalInvite(invite, auth, { now = new Date() } = {}) {
  const status = inviteStatus(invite, now);
  const reveal = canRevealPortalPassword(auth);
  const customer = invite.opportunity?.crmCustomer || invite.crmCustomer || null;
  const cipher = inviteCipher(invite);
  const registerUrl =
    status === "PENDING"
      ? `${env.webUrl}/portal/register/${invite.token}`
      : null;

  return {
    id: invite.id,
    crmCustomerId: invite.crmCustomerId,
    opportunityId: invite.opportunityId,
    customerCode: customer?.customerCode || null,
    personName: customer?.personName || null,
    companyName: customer?.companyName || null,
    whatsappNumber: registeredWhatsapp(invite) || "",
    status,
    hasPassword: Boolean(cipher),
    canRevealPassword: reveal && Boolean(cipher),
    registerUrl,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    usedAt: invite.usedAt,
    revokedAt: invite.revokedAt,
  };
}

function statusWhere(status, now) {
  if (!status || status === "ALL") return {};
  if (status === "REGISTERED") return { usedAt: { not: null } };
  if (status === "REVOKED") return { revokedAt: { not: null }, usedAt: null };
  if (status === "EXPIRED") {
    return {
      usedAt: null,
      revokedAt: null,
      expiresAt: { lt: now },
    };
  }
  if (status === "PENDING") {
    return {
      usedAt: null,
      revokedAt: null,
      expiresAt: { gte: now },
    };
  }
  return {};
}

export const portalInvitesService = {
  async list(query = {}, auth) {
    const now = new Date();
    const q = String(query.q || "").trim();
    const status = String(query.status || "ALL").toUpperCase();
    const opportunityId = String(query.opportunityId || "").trim();
    const customerId = String(query.customerId || "").trim();
    if (!opportunityId && !customerId) {
      throw new AppError(
        "شناسه فرصت یا مشتری برای فهرست دعوت الزامی است",
        400,
        "VALIDATION",
      );
    }
    const pageNum = Math.max(1, parseInt(query.page, 10) || 1);
    const size = Math.min(50, Math.max(1, parseInt(query.pageSize, 10) || 20));

    const where = {
      ...statusWhere(status, now),
    };
    if (opportunityId) where.opportunityId = opportunityId;
    if (customerId) where.crmCustomerId = customerId;

    if (q) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { whatsappNumber: { contains: q, mode: "insensitive" } },
            {
              portalAccount: {
                normalizedWhatsapp: { contains: q, mode: "insensitive" },
              },
            },
            {
              opportunity: {
                crmCustomer: {
                  OR: [
                    { personName: { contains: q, mode: "insensitive" } },
                    { companyName: { contains: q, mode: "insensitive" } },
                    { customerCode: { contains: q, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        },
      ];
    }

    const [total, rows] = await Promise.all([
      prisma.portalInvite.count({ where }),
      prisma.portalInvite.findMany({
        where,
        include: {
          opportunity: {
            select: {
              crmCustomer: {
                select: {
                  id: true,
                  customerCode: true,
                  personName: true,
                  companyName: true,
                },
              },
            },
          },
          portalAccount: {
            select: {
              id: true,
              normalizedWhatsapp: true,
              passwordCipher: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * size,
        take: size,
      }),
    ]);

    return {
      items: rows.map((row) => serializePortalInvite(row, auth, { now })),
      total,
      page: pageNum,
      pageSize: size,
      totalPages: Math.max(1, Math.ceil(total / size)),
    };
  },

  async revealPasswordForCustomer(customerId, auth, req) {
    if (!canRevealPortalPassword(auth)) {
      throw new AppError(
        "شما اجازه مشاهده رمز عبور پورتال را ندارید",
        403,
        "FORBIDDEN",
      );
    }

    const account = await prisma.portalAccount.findFirst({
      where: { crmCustomerId: customerId, deletedAt: null },
      select: {
        id: true,
        crmCustomerId: true,
        normalizedWhatsapp: true,
        passwordCipher: true,
      },
    });
    if (!account) {
      throw new AppError(
        "مشتری هنوز حساب پورتال ایجاد نکرده است",
        404,
        "PASSWORD_NOT_SET",
      );
    }

    let cipher = account.passwordCipher;
    if (!cipher) {
      const invite = await prisma.portalInvite.findFirst({
        where: {
          crmCustomerId: customerId,
          passwordCipher: { not: null },
        },
        orderBy: { usedAt: "desc" },
        select: { passwordCipher: true },
      });
      cipher = invite?.passwordCipher || null;
    }
    if (!cipher) {
      throw new AppError(
        "مشتری هنوز رمز عبور پورتال را ایجاد نکرده است",
        404,
        "PASSWORD_NOT_SET",
      );
    }

    let password;
    try {
      password = decryptCredential(cipher);
    } catch {
      password = null;
    }
    if (!password) {
      throw new AppError(
        "رمز ذخیره شده قابل بازیابی نیست. مشتری باید رمز را بازنشانی کند.",
        409,
        "PASSWORD_UNAVAILABLE",
      );
    }

    await writeAudit({
      userId: auth.userId,
      action: "PORTAL_CREDENTIAL_REVEAL",
      entityType: "PortalAccount",
      entityId: account.id,
      after: {
        crmCustomerId: account.crmCustomerId,
        whatsappNumber: account.normalizedWhatsapp,
      },
      req,
    });

    return {
      customerId: account.crmCustomerId,
      whatsappNumber: account.normalizedWhatsapp || "",
      password,
    };
  },
};
