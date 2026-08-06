import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/response.js";
import { hashPassword } from "../../utils/passwords.js";
import { generateOtp, hashToken } from "../../utils/tokens.js";
import { writeAudit } from "../../middleware/audit.js";
import { rebuildProjectContext } from "../../services/projectContext.js";
import { buildManagerContact } from "../../services/whatsapp.js";
import { storage } from "../../services/storage.js";
import bcrypt from "bcryptjs";
import {
  customerProjectWhere,
  countPendingBriefs,
  pickThumbnail,
  serializePortalProjectSummary,
  buildProjectProgress,
} from "./helpers.js";
import {
  notifyManagersOnce,
  createNotificationOnce,
  buildProjectCreatedNotification,
  buildContentApprovedByCustomerNotification,
  buildContentRevisionRequestedNotification,
} from "../../services/notifications.js";
import { narrationService } from "../narration/service.js";
import {
  sumActivePayments,
  syncProjectFinanceFromPayments,
  computeFinanceSnapshot,
  hydrateProjectsFinanceFromOpportunities,
} from "../crm/paymentFinance.js";

async function getValidInvite(token) {
  const invite = await prisma.portalInvite.findUnique({
    where: { token },
    include: { opportunity: true },
  });
  if (
    !invite ||
    invite.revokedAt ||
    invite.usedAt ||
    invite.expiresAt < new Date()
  ) {
    throw new AppError("لینک دعوت نامعتبر یا منقضی است", 400, "INVITE_INVALID");
  }
  return invite;
}

export const portalService = {
  async getInvite(token) {
    const invite = await getValidInvite(token);
    return {
      token: invite.token,
      whatsappNumber: invite.whatsappNumber,
      expiresAt: invite.expiresAt,
      opportunityId: invite.opportunityId,
      existingAccount: !!invite.portalAccountId,
    };
  },

  async requestOtp(token) {
    const invite = await getValidInvite(token);
    if (invite.attempts >= invite.maxAttempts) {
      throw new AppError(
        "حداکثر تلاش دعوت رسیده است",
        429,
        "INVITE_MAX_ATTEMPTS",
      );
    }

    const otp = generateOtp(6);
    const codeHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.$transaction([
      prisma.portalInvite.update({
        where: { id: invite.id },
        data: { attempts: { increment: 1 } },
      }),
      // Invalidate prior unused register OTPs so only the latest code is valid
      prisma.otpCode.updateMany({
        where: {
          portalInviteId: invite.id,
          purpose: "REGISTER",
          usedAt: null,
        },
        data: { usedAt: new Date() },
      }),
      prisma.otpCode.create({
        data: {
          codeHash,
          portalInviteId: invite.id,
          purpose: "REGISTER",
          expiresAt,
        },
      }),
    ]);

    // Plaintext OTP is returned when PORTAL_EXPOSE_OTP is enabled (default)
    // so registration works without an automated WhatsApp/SMS provider.
    return {
      message: "کد یک‌بارمصرف تولید شد. آن را وارد کنید یا از طریق واتساپ دریافت کنید.",
      otpDev: env.portalExposeOtp ? otp : undefined,
      expiresInMinutes: 15,
    };
  },

  async register(token, { password, otp }, req) {
    const invite = await getValidInvite(token);
    const otpRow = await prisma.otpCode.findFirst({
      where: { portalInviteId: invite.id, usedAt: null, purpose: "REGISTER" },
      orderBy: { createdAt: "desc" },
    });
    if (!otpRow || otpRow.expiresAt < new Date()) {
      throw new AppError("کد OTP منقضی یا نامعتبر است", 400, "OTP_INVALID");
    }
    if (otpRow.attempts >= otpRow.maxAttempts) {
      throw new AppError("حداکثر تلاش OTP", 429, "OTP_MAX_ATTEMPTS");
    }

    const okOtp = await bcrypt.compare(otp, otpRow.codeHash);
    if (!okOtp) {
      await prisma.otpCode.update({
        where: { id: otpRow.id },
        data: { attempts: { increment: 1 } },
      });
      throw new AppError("کد OTP نادرست است", 400, "OTP_INVALID");
    }

    if (!password || password.length < 8) {
      throw new AppError("رمز عبور حداقل ۸ کاراکتر باشد", 400, "WEAK_PASSWORD");
    }

    const passwordHash = await hashPassword(password);

    const result = await prisma.$transaction(async (tx) => {
      let account = await tx.portalAccount.findUnique({
        where: { normalizedWhatsapp: invite.whatsappNumber },
      });

      if (account) {
        // Existing customer — do not create new account (AC-06)
        account = await tx.portalAccount.update({
          where: { id: account.id },
          data: {
            passwordHash,
            isActive: true,
            registeredAt: account.registeredAt || new Date(),
          },
        });
      } else {
        account = await tx.portalAccount.create({
          data: {
            crmCustomerId: invite.crmCustomerId,
            normalizedWhatsapp: invite.whatsappNumber,
            passwordHash,
            isActive: true,
            registeredAt: new Date(),
          },
        });
      }

      await tx.otpCode.update({
        where: { id: otpRow.id },
        data: { usedAt: new Date() },
      });
      await tx.portalInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date(), portalAccountId: account.id },
      });
      await tx.crmCustomer.update({
        where: { id: invite.crmCustomerId },
        data: { portalStatus: "REGISTERED" },
      });

      return account;
    });

    await writeAudit({
      action: "PORTAL_REGISTER",
      entityType: "PortalAccount",
      entityId: result.id,
      after: { whatsapp: invite.whatsappNumber },
      req,
    });

    return {
      accountId: result.id,
      customerId: result.crmCustomerId,
      needsBrief: true,
    };
  },

  async dashboard(auth) {
    const where = customerProjectWhere(auth);
    const [projects, invoices, pendingBriefsCount, pendingApprovals] =
      await Promise.all([
        prisma.project.findMany({
          where,
          include: {
            finance: true,
            assetRefs: { include: { clientAsset: true }, take: 5 },
          },
          orderBy: { updatedAt: "desc" },
        }),
        prisma.invoice.findMany({
          where: {
            crmCustomerId: auth.customerId,
            status: { not: "CANCELED" },
            OR: [{ projectId: null }, { project: { deletedAt: null } }],
          },
          include: { payments: { where: { verification: "VERIFIED" } } },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        countPendingBriefs(auth.customerId),
        prisma.contentVersion.findMany({
          where: {
            publishedToClient: true,
            isLocked: false,
            project: where,
          },
          include: {
            project: { select: { id: true, code: true, title: true } },
          },
          take: 10,
        }),
      ]);

    const stats = {
      total: projects.length,
      active: projects.filter((p) => p.customerFacingStatus !== "COMPLETED")
        .length,
      completed: projects.filter((p) => p.customerFacingStatus === "COMPLETED")
        .length,
      pending: projects.filter((p) =>
        ["INFO_RECEIVED", "PREPARING_CONTENT"].includes(p.customerFacingStatus),
      ).length,
      underReview: projects.filter((p) =>
        ["WAITING_YOUR_APPROVAL", "FINAL_REVIEW"].includes(
          p.customerFacingStatus,
        ),
      ).length,
    };

    let totalDue = 0;
    let totalPaid = 0;
    let lastPaymentDate = null;
    for (const inv of invoices) {
      totalDue += Number(inv.total);
      for (const p of inv.payments) {
        totalPaid += Number(p.amount);
        if (!lastPaymentDate || p.paidAt > lastPaymentDate)
          lastPaymentDate = p.paidAt;
      }
    }

    // Batch live finance for all projects (2 payment queries) instead of N+1 syncs.
    const projectIds = projects.map((p) => p.id);
    if (projectIds.length) {
      const opportunities = await prisma.opportunity.findMany({
        where: { projectId: { in: projectIds }, deletedAt: null },
        select: {
          id: true,
          projectId: true,
          crmCustomerId: true,
          agreedPrice: true,
        },
      });
      await hydrateProjectsFinanceFromOpportunities(
        prisma,
        projects,
        opportunities,
      );
    }

    const summaries = projects.map(serializePortalProjectSummary);
    const totalProjectValue = projects.reduce(
      (sum, p) => sum + Number(p.finance?.finalProjectPrice || 0),
      0,
    );
    const projectReceived = projects.reduce(
      (sum, p) => sum + Number(p.finance?.received || 0),
      0,
    );
    const pendingInvoices = invoices.filter(
      (i) => !["PAID", "CANCELED"].includes(i.status),
    ).length;

    return {
      stats,
      financial: {
        totalProjectValue,
        totalPaid: projectReceived,
        remainingBalance: Math.max(0, totalProjectValue - projectReceived),
        pendingInvoices,
        lastPaymentDate,
      },
      canCreateProject: pendingBriefsCount > 0,
      pendingBriefsCount,
      projects: summaries,
      recentProjects: summaries.slice(0, 5),
      invoices: invoices.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        total: i.total,
        status: i.status,
        dueAt: i.dueAt,
      })),
      balanceSummary: { totalDue, totalPaid, balance: totalDue - totalPaid },
      pendingApprovals,
    };
  },

  async listProjects(auth, query = {}) {
    const {
      search = "",
      status = "",
      dateFrom = "",
      dateTo = "",
      sort = "updatedAt",
      order = "desc",
      page = "1",
      pageSize = "10",
    } = query;

    const where = customerProjectWhere(auth);

    if (status) where.customerFacingStatus = status;

    if (search.trim()) {
      where.OR = [
        { title: { contains: search.trim(), mode: "insensitive" } },
        { code: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(50, Math.max(1, parseInt(pageSize, 10) || 10));
    const sortField = [
      "createdAt",
      "updatedAt",
      "title",
      "deadlineAt",
    ].includes(sort)
      ? sort
      : "updatedAt";
    const sortOrder = order === "asc" ? "asc" : "desc";

    const [total, rows, pendingBriefsCount] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.findMany({
        where,
        include: {
          finance: true,
          assetRefs: { include: { clientAsset: true }, take: 5 },
        },
        orderBy: { [sortField]: sortOrder },
        skip: (pageNum - 1) * size,
        take: size,
      }),
      countPendingBriefs(auth.customerId),
    ]);

    return {
      items: rows.map(serializePortalProjectSummary),
      total,
      page: pageNum,
      pageSize: size,
      totalPages: Math.max(1, Math.ceil(total / size)),
      canCreateProject: pendingBriefsCount > 0,
      pendingBriefsCount,
    };
  },

  async getProject(projectId, auth) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, ...customerProjectWhere(auth) },
      include: {
        format: true,
        service: { select: { id: true, name: true } },
        contentVersions: {
          where: {
            OR: [
              { publishedToClient: true },
              {
                publishedAt: { not: null },
                status: {
                  in: [
                    "APPROVED",
                    "REVISION_REQUESTED",
                    "PENDING_CUSTOMER_APPROVAL",
                    "SUPERSEDED",
                  ],
                },
              },
            ],
          },
          orderBy: { versionNumber: "desc" },
        },
        files: {
          where: {
            kind: { in: ["WATERMARKED_FINAL", "CLEAN_FINAL"] },
            deletedAt: null,
          },
          orderBy: { createdAt: "desc" },
        },
        finance: true,
        downloadPermission: true,
        invoices: { include: { payments: true } },
        feedback: { orderBy: { createdAt: "desc" } },
        assetRefs: {
          include: { clientAsset: true },
          orderBy: { createdAt: "asc" },
        },
        timeline: { orderBy: { createdAt: "desc" }, take: 20 },
        crmCustomer: { select: { personName: true, companyName: true } },
      },
    });
    if (!project) throw new AppError("پروژه یافت نشد", 404, "NOT_FOUND");

    // Live payment totals for the response only — avoid rewriting caches on every GET.
    const synced = await syncProjectFinanceFromPayments(prisma, project.id, {
      persist: false,
    });
    if (synced?.projectFinance) {
      project.finance = synced.projectFinance;
    } else if (project.finance && synced?.finance) {
      project.finance = {
        ...project.finance,
        finalProjectPrice: synced.finance.projectTotal,
        received: synced.finance.totalPaid,
      };
    }

    const balance = project.finance
      ? Number(project.finance.finalProjectPrice) -
        Number(project.finance.received)
      : null;

    const {
      evaluateDeliveryAccess,
      deliverySnapshot,
      syncProjectDeliveryFields,
    } = await import("../../services/deliveryAccess.js");
    const evalResult = evaluateDeliveryAccess({
      projectStatus: project.status,
      finance: project.finance,
      downloadPermission: project.downloadPermission,
      hasCleanFile: true,
    });
    // Keep denormalized fields fresh for manager reports
    syncProjectDeliveryFields(prisma, project.id).catch(() => {});

    const brief =
      project.brief && typeof project.brief === "object" ? project.brief : {};
    const assetRefs = project.assetRefs || [];
    const snap = deliverySnapshot(evalResult);

    const { isSentToCustomer, serializeFinalVideo } =
      await import("../production/finalProduct.js");

    // Always surface every sent final video. Access control is exposed as
    // flags (canPlay / canDownload / accessLocked) — never hide CLEAN files.
    const visibleFinals = (project.files || []).filter((f) =>
      isSentToCustomer(f, project.status),
    );
    const watermarkedVisible = visibleFinals.filter(
      (f) => f.kind === "WATERMARKED_FINAL",
    );
    const cleanVisible = visibleFinals.filter((f) => f.kind === "CLEAN_FINAL");

    const mapPortalFinal = (f) => {
      const serialized = serializeFinalVideo(f, {
        projectStatus: project.status,
      });
      const isClean =
        serialized.videoType === "CLEAN" || f.kind === "CLEAN_FINAL";
      const unlocked =
        !isClean ||
        snap.cleanDownloadAvailable === true ||
        serialized.allowDownload === true;
      const accessStatus = !isClean
        ? "AVAILABLE"
        : unlocked
          ? "AVAILABLE"
          : snap.cleanFileAccess === "LOCKED_APPROVAL"
            ? "LOCKED_APPROVAL"
            : "LOCKED_PAYMENT";
      const accessMessage = !isClean
        ? null
        : unlocked
          ? null
          : snap.deliveryMessage ||
            (accessStatus === "LOCKED_APPROVAL"
              ? "پرداخت تکمیل شده است. پس از تأیید تحویل توسط مدیر، پخش و دانلود نسخه پاک فعال می‌شود."
              : "تا تسویه کامل مبلغ پروژه، نسخه بدون واترمارک قفل است. می‌توانید نسخه دارای واترمارک را مشاهده کنید.");

      return {
        id: serialized.id,
        name: serialized.name,
        mimeType: serialized.mimeType,
        sizeBytes: serialized.sizeBytes,
        version: serialized.version,
        createdAt: serialized.createdAt,
        videoType: serialized.videoType,
        videoTypeLabel: serialized.videoTypeLabel,
        status: serialized.status,
        statusLabel: serialized.statusLabel,
        sentAt: serialized.sentAt,
        allowDownload:
          unlocked && isClean
            ? true
            : serialized.allowDownload === true && unlocked,
        canPlay: unlocked,
        canDownload: unlocked && isClean,
        accessLocked: isClean && !unlocked,
        accessStatus,
        accessMessage,
        // storageKey intentionally omitted — play via /files/media/:id
      };
    };

    return {
      id: project.id,
      code: project.code,
      title: project.title,
      status: project.customerFacingStatus,
      internalStatus: project.status,
      progress: buildProjectProgress({
        status: project.status,
        customerFacingStatus: project.customerFacingStatus,
        audience: "portal",
      }),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      completedAt: project.completedAt,
      deadlineAt: project.deadlineAt,
      durationSec: project.durationSec,
      language: project.language,
      tone: project.tone,
      platforms: project.platforms,
      format: project.format
        ? {
            id: project.format.id,
            name: project.format.name,
            ratio: project.format.ratio,
          }
        : null,
      service: project.service,
      brief,
      customAspectRatio: brief.customAspectRatio || null,
      thumbnailStorageKey: pickThumbnail(project),
      contentRevisionUsed: project.contentRevisionUsed,
      contentRevisionMax:
        project.contentRevisionMax + (project.extraContentRevision ? 1 : 0),
      videoRevisionUsed: project.videoRevisionUsed,
      videoRevisionMax:
        project.videoRevisionMax + (project.extraVideoRevision ? 1 : 0),
      contentVersions: project.contentVersions,
      watermarkedFiles: watermarkedVisible.map(mapPortalFinal),
      cleanFiles: cleanVisible.map(mapPortalFinal),
      finalVideos: [...watermarkedVisible, ...cleanVisible].map(mapPortalFinal),
      assets: assetRefs
        .filter((ref) => ref.clientAsset && !ref.clientAsset.deletedAt)
        .map((ref) => ({
          id: ref.clientAsset.id,
          name: ref.clientAsset.name,
          kind: ref.clientAsset.kind,
          mimeType: ref.clientAsset.mimeType,
          sizeBytes: ref.clientAsset.sizeBytes,
          storageKey: ref.clientAsset.storageKey,
          meta: ref.clientAsset.meta,
        })),
      timeline: project.timeline.map((e) => ({
        id: e.id,
        type: e.type,
        title: e.title,
        body: e.body,
        createdAt: e.createdAt,
      })),
      invoices: project.invoices.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        total: i.total,
        status: i.status,
        dueAt: i.dueAt,
      })),
      finance: project.finance
        ? {
            finalProjectPrice: project.finance.finalProjectPrice,
            received: project.finance.received,
            balance,
          }
        : null,
      cleanDownloadAvailable: snap.cleanDownloadAvailable,
      paymentStatus: snap.paymentStatus,
      deliveryStatus: snap.deliveryStatus,
      cleanFileAccess: snap.cleanFileAccess,
      paymentSettled: snap.paymentSettled,
      managerApproved: snap.managerApproved,
      deliveryMessage: snap.deliveryMessage,
      feedback: project.feedback,
      customer: {
        personName: project.crmCustomer.personName,
        companyName: project.crmCustomer.companyName,
      },
    };
  },

  async submitBrief(projectOpportunityOrInvite, brief, auth, req) {
    // Brief can create project from opportunity after registration
    // body: { opportunityId, ...brief fields }
    const opportunityId = brief.opportunityId;
    if (!opportunityId)
      throw new AppError("opportunityId لازم است", 400, "VALIDATION");

    const opp = await prisma.opportunity.findFirst({
      where: {
        id: opportunityId,
        crmCustomerId: auth.customerId,
        deletedAt: null,
      },
      include: {
        crmCustomer: { include: { portalAccount: true, clientAssets: true } },
        invoices: { include: { payments: true } },
        service: true,
      },
    });
    if (!opp) throw new AppError("فرصت یافت نشد", 404, "NOT_FOUND");
    if (opp.projectId)
      throw new AppError("پروژه قبلاً ایجاد شده", 409, "PROJECT_EXISTS");

    const manager = await prisma.user.findFirst({
      where: { role: { code: "MANAGER" }, isActive: true, deletedAt: null },
    });
    if (!manager)
      throw new AppError("مدیر سیستم تعریف نشده", 500, "NO_MANAGER");

    let resolvedNarratorProfileId = null;
    if (brief.narratorProfileId) {
      const narratorProfile = await prisma.teamProfile.findFirst({
        where: {
          id: brief.narratorProfileId,
          kind: "NARRATOR",
          status: "ACTIVE",
          deletedAt: null,
          user: { isActive: true, deletedAt: null },
        },
        select: { id: true },
      });
      if (!narratorProfile) {
        throw new AppError(
          "نریتور انتخاب‌شده معتبر نیست یا در سیستم فعال نیست",
          400,
          "INVALID_NARRATOR",
        );
      }
      resolvedNarratorProfileId = narratorProfile.id;
    }

    const year = new Date().getFullYear();
    const count = await prisma.project.count();
    const code = `APX-${year}-${String(count + 1).padStart(4, "0")}`;

    const agreed = Number(opp.agreedPrice || opp.proposedPrice || 0);
    const depositReceived = await sumActivePayments(prisma, {
      crmCustomerId: auth.customerId,
      opportunityId: opp.id,
    });
    const financeSnap = computeFinanceSnapshot(agreed, depositReceived);

    const project = await prisma.$transaction(async (tx) => {
      const p = await tx.project.create({
        data: {
          code,
          title: brief.title || opp.title || `پروژه ${code}`,
          status: "NEW_MANAGER_REVIEW",
          customerFacingStatus: "INFO_RECEIVED",
          crmCustomerId: auth.customerId,
          portalAccountId: auth.portalAccountId,
          managerId: manager.id,
          serviceId: brief.serviceId || opp.serviceId,
          formatId: brief.formatId || null,
          durationSec: brief.durationSec || null,
          language: brief.language || "fa",
          tone: brief.tone || null,
          platforms: brief.platforms || [],
          brief: {
            personName: brief.personName,
            jobTitle: brief.jobTitle,
            companyName: brief.companyName,
            phone: brief.phone,
            address: brief.address,
            email: brief.email,
            website: brief.website,
            productName: brief.productName,
            productDescription: brief.productDescription,
            features: brief.features,
            audience: brief.audience,
            goal: brief.goal,
            mainMessage: brief.mainMessage,
            cta: brief.cta,
            allowedClaims: brief.allowedClaims,
            mandatoryTexts: brief.mandatoryTexts,
            brandLimits: brief.brandLimits,
            narratorProfileId: resolvedNarratorProfileId,
            customAspectRatio: brief.customAspectRatio || null,
          },
          contentRevisionMax: opp.service?.revisionCount || 2,
          videoRevisionMax: opp.service?.revisionCount || 2,
        },
      });

      await tx.opportunity.update({
        where: { id: opp.id },
        data: {
          projectId: p.id,
          advancePayment: financeSnap.totalPaid,
        },
      });

      // Client asset references
      const assetIds = brief.clientAssetIds || [];
      for (const assetId of assetIds) {
        const asset = await tx.clientAsset.findFirst({
          where: {
            id: assetId,
            crmCustomerId: auth.customerId,
            deletedAt: null,
          },
        });
        if (asset) {
          await tx.assetReference.create({
            data: { projectId: p.id, clientAssetId: asset.id },
          });
        }
      }

      // Order-specific uploads as project files
      for (const f of brief.files || []) {
        await tx.projectFile.create({
          data: {
            projectId: p.id,
            kind: f.kind || "OTHER",
            name: f.name,
            storageKey: f.storageKey,
            mimeType: f.mimeType,
            sizeBytes: f.sizeBytes,
          },
        });
      }

      await tx.projectFinance.create({
        data: {
          projectId: p.id,
          basePrice: agreed,
          agreedPrice: agreed,
          discount: 0,
          finalProjectPrice: financeSnap.projectTotal,
          received: financeSnap.totalPaid,
        },
      });

      // Attach deposit invoices to project
      await tx.invoice.updateMany({
        where: { opportunityId: opp.id },
        data: { projectId: p.id },
      });

      if (resolvedNarratorProfileId) {
        await tx.projectAssignment.create({
          data: {
            projectId: p.id,
            role: "PROPOSED_NARRATOR",
            teamProfileId: resolvedNarratorProfileId,
          },
        });
      }

      await tx.projectAssignment.create({
        data: {
          projectId: p.id,
          role: "MANAGER",
          userId: manager.id,
        },
      });

      await tx.projectTimelineEvent.create({
        data: {
          projectId: p.id,
          type: "CREATED",
          title: "پروژه ایجاد شد",
          body: "فرم اطلاعات پروژه ارسال شد",
          actorId: auth.portalAccountId,
        },
      });

      await tx.downloadPermission.create({
        data: { projectId: p.id, allowed: false },
      });

      await rebuildProjectContext(p.id, tx);

      const customerName =
        brief.companyName ||
        brief.personName ||
        opp.crmCustomer?.companyName ||
        opp.crmCustomer?.personName ||
        "مشتری";

      // Exactly one manager notification per project (idempotent per recipient).
      await notifyManagersOnce(
        buildProjectCreatedNotification({
          projectId: p.id,
          projectCode: p.code,
          projectTitle: p.title,
          customerName,
          createdAt: new Date(),
        }),
        tx,
      );

      if (auth.portalAccountId) {
        await createNotificationOnce(
          {
            portalAccountId: auth.portalAccountId,
            audience: "PORTAL",
            eventKey: `project.created.portal:${p.id}`,
            title: "پروژه با موفقیت ایجاد شد",
            body: `${p.title} (${p.code}) آماده بررسی است.`,
            link: `/portal/projects/${p.id}`,
            meta: {
              type: "PROJECT_CREATED",
              projectId: p.id,
              projectCode: p.code,
              projectName: p.title,
              statusLabel: "اطلاعات دریافت شد",
            },
          },
          tx,
        );
      }

      return p;
    });

    await writeAudit({
      action: "PROJECT_AUTO_CREATE",
      entityType: "Project",
      entityId: project.id,
      after: { code: project.code, opportunityId },
      req,
    });

    return project;
  },

  async approveContent(versionId, auth, req) {
    const version = await prisma.contentVersion.findFirst({
      where: { id: versionId, publishedToClient: true },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            code: true,
            crmCustomerId: true,
          },
        },
      },
    });
    if (!version || version.project.crmCustomerId !== auth.customerId) {
      throw new AppError("نسخه یافت نشد", 404, "NOT_FOUND");
    }
    if (version.status === "APPROVED" && version.isLocked) {
      throw new AppError(
        "این نسخه قبلاً تأیید شده است",
        400,
        "ALREADY_APPROVED",
      );
    }
    if (version.status === "REVISION_REQUESTED") {
      throw new AppError(
        "برای این نسخه درخواست اصلاح ثبت شده است",
        400,
        "REVISION_PENDING",
      );
    }

    const approvedAt = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.approval.create({
        data: {
          projectId: version.projectId,
          contentVersionId: version.id,
          type: "CLIENT_CONTENT",
          decision: "APPROVED",
          actorType: "CUSTOMER",
          actorId: auth.portalAccountId,
        },
      });
      await tx.contentVersion.update({
        where: { id: version.id },
        data: {
          status: "APPROVED",
          isLocked: true,
          publishedToClient: true,
        },
      });
      await tx.project.update({
        where: { id: version.projectId },
        data: {
          status: "NARRATION_RECORDING",
          customerFacingStatus: "IN_PRODUCTION",
        },
      });

      // Prepare narration task shell for managers — narrator is assigned only via manual send.
      await narrationService.ensureTaskForProject(version.projectId, {
        tx,
        contentVersionId: version.id,
      });

      await tx.projectTimelineEvent.create({
        data: {
          projectId: version.projectId,
          type: "CLIENT_CONTENT_APPROVED",
          title: "تأیید محتوای مشتری",
          body: `نسخه ${version.versionNumber}`,
          actorId: auth.portalAccountId,
        },
      });
      await rebuildProjectContext(version.projectId, tx);
    });

    await notifyManagersOnce(
      buildContentApprovedByCustomerNotification({
        projectId: version.projectId,
        projectTitle: version.project.title,
        projectCode: version.project.code,
        versionNumber: version.versionNumber,
        approvedAt,
      }),
    );

    await writeAudit({
      action: "CLIENT_CONTENT_APPROVE",
      entityType: "ContentVersion",
      entityId: versionId,
      req,
    });

    return { approved: true };
  },

  async requestContentChanges(versionId, { body, reason }, auth, req) {
    const feedbackText = String(body || "").trim();
    const reasonText = String(reason || "").trim();
    if (!feedbackText)
      throw new AppError("توضیح تغییرات الزامی است", 400, "FEEDBACK_REQUIRED");

    const version = await prisma.contentVersion.findFirst({
      where: { id: versionId, publishedToClient: true },
      include: {
        project: true,
      },
    });
    if (!version || version.project.crmCustomerId !== auth.customerId) {
      throw new AppError("نسخه یافت نشد", 404, "NOT_FOUND");
    }
    if (version.status === "APPROVED" && version.isLocked) {
      throw new AppError(
        "نسخه تأییدشده قابل درخواست اصلاح نیست",
        400,
        "LOCKED",
      );
    }

    const project = version.project;
    const max =
      project.contentRevisionMax + (project.extraContentRevision ? 1 : 0);
    if (project.contentRevisionUsed >= max) {
      throw new AppError(
        "سقف اصلاح تکمیل شده؛ فقط مدیر می‌تواند Extra Revision فعال کند",
        403,
        "REVISION_LIMIT",
      );
    }

    const notes = reasonText
      ? `دلیل: ${reasonText}\n\nتوضیحات: ${feedbackText}`
      : feedbackText;
    const requestedAt = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.clientFeedback.create({
        data: {
          projectId: project.id,
          contentVersionId: version.id,
          scope: "CONTENT",
          body: notes,
        },
      });
      await tx.approval.create({
        data: {
          projectId: project.id,
          contentVersionId: version.id,
          type: "CLIENT_CONTENT",
          decision: "CHANGES_REQUESTED",
          comment: notes,
          actorType: "CUSTOMER",
          actorId: auth.portalAccountId,
        },
      });
      await tx.contentVersion.update({
        where: { id: version.id },
        data: {
          status: "REVISION_REQUESTED",
          isLocked: true,
          rejectionReason: notes,
          rejectedById: auth.portalAccountId,
        },
      });
      await tx.project.update({
        where: { id: project.id },
        data: {
          contentRevisionUsed: { increment: 1 },
          status: "CONTENT_REVISION",
          customerFacingStatus: "PREPARING_CONTENT",
        },
      });
      await tx.projectTimelineEvent.create({
        data: {
          projectId: project.id,
          type: "CLIENT_CONTENT_REVISION_REQUESTED",
          title: "درخواست اصلاح محتوا توسط مشتری",
          body: `نسخه ${version.versionNumber}`,
          actorId: auth.portalAccountId,
        },
      });
      await rebuildProjectContext(project.id, tx);
    });

    await notifyManagersOnce(
      buildContentRevisionRequestedNotification({
        projectId: project.id,
        projectTitle: project.title,
        projectCode: project.code,
        versionNumber: version.versionNumber,
        feedbackPreview: notes,
        requestedAt,
      }),
    );

    await writeAudit({
      action: "CLIENT_CONTENT_CHANGES",
      entityType: "ContentVersion",
      entityId: versionId,
      after: { body: notes, reason: reasonText || null },
      req,
    });

    return { requested: true };
  },

  async approveFinal(projectId, auth, req) {
    const videoType = String(req?.body?.videoType || req?.body?.type || "")
      .trim()
      .toUpperCase();

    const project = await prisma.project.findFirst({
      where: { id: projectId, crmCustomerId: auth.customerId, deletedAt: null },
      include: {
        finance: true,
        downloadPermission: true,
        files: {
          where: {
            kind: { in: ["CLEAN_FINAL", "WATERMARKED_FINAL"] },
            deletedAt: null,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!project) throw new AppError("پروژه یافت نشد", 404, "NOT_FOUND");

    if (project.status === "COMPLETED" && project.completedAt) {
      return {
        approved: true,
        completed: true,
        alreadyCompleted: true,
        status: "COMPLETED",
        completedAt: project.completedAt,
      };
    }

    const { isSentToCustomer, asMeta } =
      await import("../production/finalProduct.js");
    const sentFinals = (project.files || []).filter((f) =>
      isSentToCustomer(f, project.status),
    );
    const cleanSent = sentFinals.filter((f) => f.kind === "CLEAN_FINAL");
    const watermarkedSent = sentFinals.filter(
      (f) => f.kind === "WATERMARKED_FINAL",
    );

    if (!sentFinals.length) {
      throw new AppError(
        "محصول نهایی هنوز برای شما ارسال نشده است",
        400,
        "FINAL_NOT_SENT",
      );
    }

    const { evaluateDeliveryAccess, syncProjectDeliveryFields } =
      await import("../../services/deliveryAccess.js");
    const access = evaluateDeliveryAccess({
      projectStatus: project.status,
      finance: project.finance,
      downloadPermission: project.downloadPermission,
      hasCleanFile:
        cleanSent.length > 0 ||
        (project.files || []).some((f) => f.kind === "CLEAN_FINAL"),
    });
    const fileAllowsPlay = cleanSent.some(
      (f) => asMeta(f.meta).allowDownload === true,
    );
    const cleanUnlocked =
      cleanSent.length > 0 && (access.cleanDownloadAllowed || fileAllowsPlay);
    const awaitingClientDecision =
      project.status === "WAITING_CLIENT_FINAL_APPROVAL";

    // Path A — clean unlocked: confirming the clean file completes the project.
    if (cleanUnlocked) {
      if (videoType && videoType !== "CLEAN") {
        throw new AppError(
          "فقط تأیید نسخه بدون واترمارک پروژه را تکمیل می‌کند",
          400,
          "CLEAN_REQUIRED",
        );
      }

      const completedAt = new Date();
      const fileId = req?.body?.fileId || cleanSent[0]?.id || null;

      await prisma.$transaction(async (tx) => {
        await tx.approval.create({
          data: {
            projectId,
            type: "CLIENT_FINAL",
            decision: "APPROVED",
            comment: fileId
              ? `تأیید نسخه بدون واترمارک (${fileId})`
              : "تأیید نسخه بدون واترمارک",
            actorType: "CUSTOMER",
            actorId: auth.portalAccountId,
          },
        });

        const { markSentFinalsApprovedByCustomer } =
          await import("../production/finalProduct.js");
        await markSentFinalsApprovedByCustomer(tx, projectId, {
          approvedAt: completedAt,
        });
      });

      const { markProjectCompleted } =
        await import("../../services/projectCompletion.js");
      const result = await markProjectCompleted(prisma, {
        projectId,
        crmCustomerId: project.crmCustomerId,
        previousStatus: project.status,
        completedAt,
        timelineType: "CLEAN_FINAL_APPROVED",
        timelineTitle: "تأیید نسخه بدون واترمارک — پروژه تکمیل شد",
        timelineBody: "مشتری نسخه نهایی بدون واترمارک را تأیید کرد",
        notifyProgress: false,
      });

      try {
        await syncProjectDeliveryFields(prisma, projectId, {
          projectPatch: {
            deliveryStatus: "COMPLETED",
            cleanFileAccess: "AVAILABLE",
          },
        });
      } catch (err) {
        console.error("[delivery] sync after clean approve", err.message);
      }

      if (!result.alreadyCompleted) {
        try {
          const { productionService } =
            await import("../production/service.js");
          await productionService.onCustomerApprove(projectId, { completedAt });
        } catch (err) {
          console.error("[production] onCustomerApprove", err.message);
        }
      }

      await writeAudit({
        action: "CLIENT_CLEAN_FINAL_APPROVE",
        entityType: "Project",
        entityId: projectId,
        after: { videoType: "CLEAN", status: "COMPLETED", completedAt },
        req,
      });

      return {
        approved: true,
        completed: true,
        alreadyCompleted: result.alreadyCompleted,
        status: "COMPLETED",
        completedAt: result.completedAt,
      };
    }

    // Path B — awaiting client decision while clean is still locked:
    // accept the final product and advance to payment / delivery unlock.
    if (!awaitingClientDecision) {
      throw new AppError(
        access.message ||
          "نسخه بدون واترمارک هنوز در دسترس نیست. پس از تسویه و فعال‌سازی تحویل می‌توانید تأیید نهایی را ثبت کنید.",
        403,
        "CLEAN_LOCKED",
      );
    }

    const approvedAt = new Date();
    const fileId =
      req?.body?.fileId || cleanSent[0]?.id || watermarkedSent[0]?.id || null;
    const balance = access.balance;
    const paymentSettled = balance != null && balance <= 0;

    await prisma.$transaction(async (tx) => {
      await tx.approval.create({
        data: {
          projectId,
          type: "CLIENT_FINAL",
          decision: "APPROVED",
          comment: fileId
            ? `تأیید محصول نهایی توسط مشتری (${fileId})`
            : "تأیید محصول نهایی توسط مشتری",
          actorType: "CUSTOMER",
          actorId: auth.portalAccountId,
        },
      });

      const { markSentFinalsApprovedByCustomer } =
        await import("../production/finalProduct.js");
      await markSentFinalsApprovedByCustomer(tx, projectId, { approvedAt });

      await tx.project.update({
        where: { id: projectId },
        data: {
          status: "WAITING_PAYMENT",
          customerFacingStatus: "WAITING_PAYMENT",
        },
      });

      await tx.projectTimelineEvent.create({
        data: {
          projectId,
          type: "CLIENT_FINAL_APPROVED",
          title: "تأیید محصول نهایی توسط مشتری",
          body: paymentSettled
            ? "مشتری محصول نهایی را تأیید کرد — در انتظار فعال‌سازی تحویل"
            : "مشتری محصول نهایی را تأیید کرد — در انتظار تسویه پرداخت",
          actorId: auth.portalAccountId,
        },
      });
    });

    try {
      const { notifyProjectProgressChange } =
        await import("../../services/projectProgress.js");
      await notifyProjectProgressChange(prisma, {
        projectId,
        previousStatus: project.status,
        nextStatus: "WAITING_PAYMENT",
      });
    } catch (err) {
      console.error(
        "[progress] notify after final quality approve",
        err?.message || err,
      );
    }

    try {
      await syncProjectDeliveryFields(prisma, projectId);
    } catch (err) {
      console.error(
        "[delivery] sync after final quality approve",
        err?.message || err,
      );
    }

    await notifyManagersOnce({
      eventKey: `project.final-approved:${projectId}:${approvedAt.toISOString()}`,
      title: "مشتری محصول نهایی را تأیید کرد",
      body: [
        `مشتری محصول نهایی پروژه «${project.title}» را تأیید کرد.`,
        project.code ? `شناسه: ${project.code}` : null,
        paymentSettled
          ? "پرداخت تسویه است — در صورت آمادگی، تحویل نسخه پاک را فعال کنید."
          : "پروژه در انتظار تسویه پرداخت است.",
      ]
        .filter(Boolean)
        .join("\n"),
      link: `/projects/${projectId}?tab=production&workspace=final`,
      meta: {
        type: "CLIENT_FINAL_APPROVED",
        projectId,
        projectCode: project.code || null,
        projectName: project.title,
        actionType: "CLIENT_FINAL_APPROVED",
        createdAt: approvedAt.toISOString(),
      },
    });

    await writeAudit({
      action: "CLIENT_FINAL_APPROVE",
      entityType: "Project",
      entityId: projectId,
      after: {
        videoType: videoType || null,
        status: "WAITING_PAYMENT",
        paymentSettled,
        fileId,
      },
      req,
    });

    return {
      approved: true,
      completed: false,
      awaitingPayment: !paymentSettled,
      awaitingDeliveryUnlock: paymentSettled,
      status: "WAITING_PAYMENT",
      customerFacingStatus: "WAITING_PAYMENT",
    };
  },

  async requestFinalChanges(projectId, { body }, auth, req) {
    if (!body?.trim())
      throw new AppError("توضیح تغییرات الزامی است", 400, "FEEDBACK_REQUIRED");
    const project = await prisma.project.findFirst({
      where: { id: projectId, crmCustomerId: auth.customerId, deletedAt: null },
    });
    if (!project) throw new AppError("پروژه یافت نشد", 404, "NOT_FOUND");

    const max = project.videoRevisionMax + (project.extraVideoRevision ? 1 : 0);
    if (project.videoRevisionUsed >= max) {
      throw new AppError("سقف اصلاح ویدیو تکمیل شده", 403, "REVISION_LIMIT");
    }

    await prisma.$transaction(async (tx) => {
      await tx.clientFeedback.create({
        data: { projectId, scope: "FINAL_VIDEO", body },
      });
      await tx.project.update({
        where: { id: projectId },
        data: {
          videoRevisionUsed: { increment: 1 },
          status: "FINAL_REVISION",
          customerFacingStatus: "FINAL_REVIEW",
        },
      });
      const editor = await tx.projectAssignment.findFirst({
        where: { projectId, role: "EDITOR", isActive: true },
      });
      if (editor) {
        await tx.projectTimelineEvent.create({
          data: {
            projectId,
            type: "FINAL_REVISION",
            title: "اصلاح نهایی درخواستی مشتری",
            body,
          },
        });
      }
    });

    try {
      const { productionService } = await import("../production/service.js");
      await productionService.onCustomerRevision(projectId, body);
    } catch (err) {
      console.error("[production] onCustomerRevision", err.message);
    }

    await writeAudit({
      action: "CLIENT_FINAL_CHANGES",
      entityType: "Project",
      entityId: projectId,
      after: { body },
      req,
    });
    return { requested: true };
  },

  async newOrder({ serviceId, goal, durationSec, description }, auth, req) {
    const customer = await prisma.crmCustomer.findUnique({
      where: { id: auth.customerId },
    });
    const opp = await prisma.opportunity.create({
      data: {
        crmCustomerId: auth.customerId,
        title: `سفارش جدید پورتال — ${customer.companyName || customer.personName}`,
        pipelineStage: "NEW_LEAD",
        serviceId: serviceId || null,
      },
    });
    await prisma.crmCustomer.update({
      where: { id: auth.customerId },
      data: { pipelineStage: "NEW_LEAD" },
    });

    await writeAudit({
      action: "PORTAL_NEW_ORDER",
      entityType: "Opportunity",
      entityId: opp.id,
      after: { serviceId, goal },
      req,
    });

    // AC-23: Opportunity only, no Project
    return { opportunityId: opp.id, projectCreated: false };
  },

  async getDownload(projectId, auth, req) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, crmCustomerId: auth.customerId, deletedAt: null },
      include: {
        finance: true,
        downloadPermission: true,
        files: {
          where: { kind: "CLEAN_FINAL", deletedAt: null },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!project) throw new AppError("پروژه یافت نشد", 404, "NOT_FOUND");

    const { evaluateDeliveryAccess, syncProjectDeliveryFields } =
      await import("../../services/deliveryAccess.js");
    const evalResult = evaluateDeliveryAccess({
      projectStatus: project.status,
      finance: project.finance,
      downloadPermission: project.downloadPermission,
      hasCleanFile: project.files.length > 0,
    });

    if (evalResult.cleanFileAccess === "LOCKED_PAYMENT") {
      throw new AppError(
        evalResult.message || "تا تسویه کامل، فایل پاک در دسترس نیست",
        403,
        "BALANCE_OUTSTANDING",
      );
    }
    if (
      evalResult.cleanFileAccess === "LOCKED_APPROVAL" ||
      !evalResult.cleanDownloadAllowed
    ) {
      throw new AppError(
        evalResult.message || "دانلود هنوز توسط مدیر فعال نشده",
        403,
        "DOWNLOAD_LOCKED",
      );
    }

    const file = project.files[0];
    if (!file) throw new AppError("فایل پاک یافت نشد", 404, "NO_FILE");

    const signed = storage.createSignedUrl({
      key: file.storageKey,
      projectId,
      portalAccountId: auth.portalAccountId,
      kind: "CLEAN_FINAL",
    });

    const now = new Date();
    await prisma.downloadHistory.create({
      data: {
        downloadPermissionId: project.downloadPermission.id,
        projectId,
        portalAccountId: auth.portalAccountId,
        crmCustomerId: auth.customerId,
        fileId: file.id,
        fileType: "CLEAN_FINAL",
        signedUrlExpiresAt: new Date(Date.now() + signed.expiresIn * 1000),
        tokenHash: hashToken(signed.token),
        downloadedAt: now,
        ipAddress: req?.ip || null,
        userAgent: req?.get?.("user-agent") || null,
        meta: {
          fileName: file.name,
          version: file.version,
          projectCode: project.code,
        },
      },
    });

    // Fallback: first clean download can still complete if customer never used Confirm.
    // Approval path is preferred; this stays idempotent and does not re-notify staff.
    let justCompleted = false;
    if (project.status !== "COMPLETED") {
      const { markProjectCompleted } =
        await import("../../services/projectCompletion.js");
      const completion = await markProjectCompleted(prisma, {
        projectId,
        crmCustomerId: project.crmCustomerId,
        previousStatus: project.status,
        completedAt: now,
        timelineType: "CLEAN_DELIVERED",
        timelineTitle: "تحویل نسخه پاک — پروژه تکمیل شد",
        timelineBody: `دانلود توسط مشتری · نسخه ${file.version ?? 1}`,
        notifyProgress: false,
      });
      justCompleted = completion.completed && !completion.alreadyCompleted;
    } else {
      await syncProjectDeliveryFields(prisma, projectId, {
        markDelivered: true,
      });
    }

    await syncProjectDeliveryFields(prisma, projectId, {
      projectPatch: {
        deliveryStatus: "COMPLETED",
        cleanFileAccess: "AVAILABLE",
      },
    });

    return {
      ...signed,
      file: {
        id: file.id,
        name: file.name,
        version: file.version,
        mimeType: file.mimeType,
      },
      projectCompleted: justCompleted || project.status === "COMPLETED",
      justCompleted,
    };
  },

  async contactManager(projectId, auth) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, crmCustomerId: auth.customerId, deletedAt: null },
      include: { crmCustomer: true },
    });
    if (!project) throw new AppError("پروژه یافت نشد", 404, "NOT_FOUND");
    return buildManagerContact({
      customerName: project.crmCustomer.personName,
      projectId: project.code,
    });
  },

  async profile(auth) {
    return prisma.crmCustomer.findUnique({
      where: { id: auth.customerId },
      select: {
        id: true,
        personName: true,
        companyName: true,
        jobTitle: true,
        phone: true,
        normalizedWhatsapp: true,
        email: true,
        city: true,
        address: true,
      },
    });
  },

  /** Open opportunities waiting for a project brief. */
  async pendingBriefs(auth) {
    const opps = await prisma.opportunity.findMany({
      where: {
        crmCustomerId: auth.customerId,
        deletedAt: null,
        projectId: null,
        pipelineStage: { notIn: ["CANCELED", "COMPLETED"] },
      },
      include: { service: true },
      orderBy: { createdAt: "desc" },
    });
    return opps.map((o) => ({
      id: o.id,
      title: o.title,
      agreedPrice: o.agreedPrice,
      service: o.service ? { id: o.service.id, name: o.service.name } : null,
      createdAt: o.createdAt,
    }));
  },

  async createClientAsset(
    auth,
    { kind, name, storageKey, mimeType, sizeBytes, meta },
  ) {
    if (!storageKey || !name)
      throw new AppError("نام و مسیر فایل الزامی است", 400, "VALIDATION");
    return prisma.clientAsset.create({
      data: {
        crmCustomerId: auth.customerId,
        kind: kind || "OTHER",
        name,
        storageKey,
        mimeType: mimeType || null,
        sizeBytes: sizeBytes != null ? Number(sizeBytes) : null,
        meta: meta || undefined,
      },
    });
  },

  async listClientAssets(auth) {
    return prisma.clientAsset.findMany({
      where: { crmCustomerId: auth.customerId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  },

  async softDeleteClientAsset(auth, id) {
    const asset = await prisma.clientAsset.findFirst({
      where: { id, crmCustomerId: auth.customerId, deletedAt: null },
    });
    if (!asset) throw new AppError("فایل یافت نشد", 404, "NOT_FOUND");
    return prisma.clientAsset.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};

export const registerSchema = z.object({
  password: z.string().min(8),
  otp: z.string().length(6),
});

export const briefSchema = z.object({
  opportunityId: z.string().min(1, "opportunityId لازم است"),
  personName: z.string().min(2, "نام سفارش‌دهنده حداقل ۲ حرف باشد"),
  jobTitle: z.string().min(1, "سمت الزامی است"),
  companyName: z.string().min(1, "نام شرکت الزامی است"),
  phone: z.string().min(5, "شماره تماس الزامی است"),
  address: z.string().min(3, "آدرس الزامی است"),
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .string()
      .email("ایمیل معتبر نیست؛ خالی بگذارید یا آدرس درست وارد کنید")
      .optional(),
  ),
  website: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().optional(),
  ),
  productName: z.string().optional(),
  productDescription: z.string().optional(),
  features: z.array(z.string()).optional(),
  audience: z.string().optional(),
  goal: z.string().optional(),
  mainMessage: z.string().optional(),
  cta: z.string().optional(),
  durationSec: z.number().int().positive().optional(),
  formatId: z.string().optional(),
  customAspectRatio: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .string()
      .regex(/^\d{1,3}:\d{1,3}$/, "نسبت تصویر سفارشی نامعتبر است")
      .optional(),
  ),
  language: z.string().optional(),
  tone: z.string().optional(),
  narratorProfileId: z.string().optional(),
  platforms: z.array(z.string()).optional(),
  clientAssetIds: z.array(z.string()).optional(),
  files: z
    .array(
      z.object({
        kind: z.string().optional(),
        name: z.string(),
        storageKey: z.string(),
        mimeType: z.string().optional(),
        sizeBytes: z.number().optional(),
      }),
    )
    .optional(),
  title: z.string().optional(),
  serviceId: z.string().optional(),
});
