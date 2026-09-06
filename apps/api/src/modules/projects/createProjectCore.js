/**
 * Shared project-creation core used by:
 * - Customer Portal (submitBrief)
 * - Manager / authorized staff (createForCustomer)
 *
 * Guarantees the same project graph for dashboards & finance:
 * Project → Opportunity link → ProjectFinance → invoices → assignment →
 * timeline → download permission → CRM event → manager notifications.
 */

import { rebuildProjectContext } from '../../services/projectContext.js';
import {
  computeFinanceSnapshot,
  sumActivePayments,
} from '../crm/paymentFinance.js';
import { openFreshCycleOpportunity } from '../crm/repeatCycle.js';
import { getCustomerPersonName } from '../../utils/crmCustomerName.js';
import { AppError } from '../../utils/response.js';
import {
  notifyManagersOnce,
  createNotificationOnce,
  buildProjectCreatedNotification,
} from '../../services/notifications.js';

function trimOrNull(value) {
  const text = String(value || '').trim();
  return text || null;
}

/**
 * Resolve contract price for a project cycle.
 * Prefer positive opportunity contract values; fall back to explicit override.
 */
export function resolveAgreedPrice(opportunity, overridePrice) {
  const fromOpp = Number(opportunity?.agreedPrice || opportunity?.proposedPrice || 0);
  if (Number.isFinite(fromOpp) && fromOpp > 0) return fromOpp;
  const fromInput = Number(overridePrice || 0);
  if (Number.isFinite(fromInput) && fromInput > 0) return fromInput;
  return 0;
}

/**
 * Find an open opportunity that already has contract/payment data and no project.
 * Mirrors the portal path where CRM locks price before the brief is submitted.
 */
export async function findAttachableOpportunity(tx, crmCustomerId) {
  return tx.opportunity.findFirst({
    where: {
      crmCustomerId,
      deletedAt: null,
      projectId: null,
      pipelineStage: { not: 'LOST_CANCELED' },
      OR: [
        { agreedPrice: { not: null } },
        { proposedPrice: { not: null } },
        { contractLocked: true },
        { invoices: { some: {} } },
        { payments: { some: {} } },
      ],
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    include: { service: true },
  });
}

/**
 * Resolve which opportunity a new project should attach to.
 *
 * Priority:
 * 1. Explicit opportunityId (must belong to customer, no project yet)
 * 2. Existing open opportunity with contract/payment data
 * 3. Fresh blank cycle opportunity
 */
export async function resolveOpportunityForProjectCreate(
  tx,
  customer,
  {
    opportunityId = null,
    title = null,
    pipelineStage = null,
    alwaysCreateFresh = false,
  } = {},
) {
  if (opportunityId) {
    const opp = await tx.opportunity.findFirst({
      where: {
        id: opportunityId,
        crmCustomerId: customer.id,
        deletedAt: null,
      },
      include: { service: true },
    });
    if (!opp) throw new AppError('فرصت یافت نشد', 404, 'NOT_FOUND');
    if (opp.projectId) {
      throw new AppError('پروژه قبلاً ایجاد شده', 409, 'PROJECT_EXISTS');
    }
    return { opportunity: opp, created: false };
  }

  if (!alwaysCreateFresh) {
    const attachable = await findAttachableOpportunity(tx, customer.id);
    if (attachable) {
      return { opportunity: attachable, created: false };
    }
  }

  return openFreshCycleOpportunity(tx, customer, {
    alwaysCreate: alwaysCreateFresh,
    title,
    pipelineStage,
  });
}

/**
 * Compute finance snapshot for an opportunity (verified deposits included).
 */
export async function buildProjectFinanceSnapshot(db, {
  crmCustomerId,
  opportunityId,
  agreedPrice,
}) {
  const depositReceived = await sumActivePayments(db, {
    crmCustomerId,
    opportunityId,
  });
  return computeFinanceSnapshot(agreedPrice, depositReceived);
}

/**
 * Create the full project graph inside an existing transaction.
 * Callers must supply a resolved opportunity + manager + customer.
 *
 * @returns {Promise<{ project: object, opportunityId: string, financeSnap: object }>}
 */
export async function createProjectGraph(tx, {
  opportunity,
  customer,
  manager,
  brief,
  source,
  actorId,
  portalAccountId = null,
  service = null,
  agreedPrice,
  financeSnap = null,
  projectFiles = [],
  timelineBody = 'پروژه ایجاد شد',
  notifyPortal = false,
}) {
  const crmCustomerId = customer.id;
  const year = new Date().getFullYear();
  const count = await tx.project.count();
  const code = `APX-${year}-${String(count + 1).padStart(4, '0')}`;

  const agreed = Number(agreedPrice || 0);
  const snap =
    financeSnap ||
    (await buildProjectFinanceSnapshot(tx, {
      crmCustomerId,
      opportunityId: opportunity.id,
      agreedPrice: agreed,
    }));

  const revisionCount =
    service?.revisionCount ||
    opportunity.service?.revisionCount ||
    2;

  const briefWhatsapp =
    trimOrNull(brief.whatsapp) ||
    customer.whatsappRaw ||
    customer.normalizedWhatsapp ||
    null;

  const title =
    trimOrNull(brief.title) ||
    trimOrNull(opportunity.title) ||
    `پروژه ${code}`;

  const briefPayload = {
    personName: trimOrNull(brief.personName) || customer.personName,
    jobTitle: trimOrNull(brief.jobTitle) || customer.jobTitle,
    companyName: trimOrNull(brief.companyName) || customer.companyName,
    phone:
      trimOrNull(brief.phone) ||
      customer.phone ||
      customer.whatsappRaw,
    whatsapp: briefWhatsapp,
    address: trimOrNull(brief.address) || customer.address,
    email: trimOrNull(brief.email) || customer.email,
    website: trimOrNull(brief.website),
    productName: trimOrNull(brief.productName),
    productDescription: trimOrNull(brief.productDescription),
    features: Array.isArray(brief.features)
      ? brief.features.map((f) => String(f).trim()).filter(Boolean)
      : [],
    audience: trimOrNull(brief.audience),
    goal: trimOrNull(brief.goal),
    mainMessage: trimOrNull(brief.mainMessage),
    cta: trimOrNull(brief.cta),
    allowedClaims: brief.allowedClaims ?? undefined,
    mandatoryTexts: brief.mandatoryTexts ?? undefined,
    brandLimits: brief.brandLimits ?? undefined,
    customAspectRatio: trimOrNull(brief.customAspectRatio),
  };

  if (source === 'INTERNAL') {
    briefPayload.managerNotes = trimOrNull(brief.notes);
    briefPayload.createdBy = 'INTERNAL';
    briefPayload.createdByUserId = actorId || null;
  }

  // Strip undefined keys so Prisma JSON stays clean
  for (const key of Object.keys(briefPayload)) {
    if (briefPayload[key] === undefined) delete briefPayload[key];
  }

  const serviceId =
    service?.id || brief.serviceId || opportunity.serviceId || null;

  const p = await tx.project.create({
    data: {
      code,
      title,
      status: 'NEW_MANAGER_REVIEW',
      customerFacingStatus: 'INFO_RECEIVED',
      crmCustomerId,
      portalAccountId:
        portalAccountId || customer.portalAccount?.id || null,
      managerId: manager.id,
      serviceId,
      formatId: brief.formatId || null,
      durationSec: brief.durationSec || null,
      language: trimOrNull(brief.language) || 'fa',
      tone: trimOrNull(brief.tone),
      platforms: Array.isArray(brief.platforms) ? brief.platforms : [],
      brief: briefPayload,
      contentRevisionMax: revisionCount,
      videoRevisionMax: revisionCount,
    },
  });

  const opportunityUpdate = {
    projectId: p.id,
    advancePayment: snap.totalPaid,
  };
  // Persist contract price onto opportunity when missing (internal create / fresh cycle)
  if (agreed > 0) {
    if (opportunity.agreedPrice == null) opportunityUpdate.agreedPrice = agreed;
    if (opportunity.proposedPrice == null) opportunityUpdate.proposedPrice = agreed;
  }
  if (serviceId && !opportunity.serviceId) {
    opportunityUpdate.serviceId = serviceId;
  }

  await tx.opportunity.update({
    where: { id: opportunity.id },
    data: opportunityUpdate,
  });

  const assetIds = Array.isArray(brief.clientAssetIds)
    ? brief.clientAssetIds
    : [];
  for (const assetId of assetIds) {
    const asset = await tx.clientAsset.findFirst({
      where: {
        id: assetId,
        crmCustomerId,
        deletedAt: null,
      },
    });
    if (asset) {
      await tx.assetReference.create({
        data: { projectId: p.id, clientAssetId: asset.id },
      });
    }
  }

  for (const f of projectFiles || []) {
    await tx.projectFile.create({
      data: {
        projectId: p.id,
        kind: f.kind || 'OTHER',
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
      finalProjectPrice: snap.projectTotal,
      received: snap.totalPaid,
    },
  });

  // Attach any deposit invoices already on this opportunity (portal + CRM path)
  await tx.invoice.updateMany({
    where: { opportunityId: opportunity.id },
    data: { projectId: p.id },
  });

  await tx.projectAssignment.create({
    data: {
      projectId: p.id,
      role: 'MANAGER',
      userId: manager.id,
    },
  });

  await tx.projectTimelineEvent.create({
    data: {
      projectId: p.id,
      type: 'CREATED',
      title: 'پروژه ایجاد شد',
      body: timelineBody,
      actorId: actorId || null,
    },
  });

  await tx.downloadPermission.create({
    data: { projectId: p.id, allowed: false },
  });

  await rebuildProjectContext(p.id, tx);

  const otherProjects = await tx.project.count({
    where: {
      crmCustomerId,
      deletedAt: null,
      id: { not: p.id },
    },
  });

  const { applyCrmEvent } = await import('../crm/sync.js');
  const { CRM_EVENTS } = await import('../crm/pipeline.js');
  await applyCrmEvent(tx, {
    customerId: crmCustomerId,
    opportunityId: opportunity.id,
    event: CRM_EVENTS.PROJECT_CREATED,
    source,
    relatedType: 'Project',
    relatedId: p.id,
    isRepeat: otherProjects > 0,
    title: otherProjects > 0 ? 'سفارش تکراری / پروژه جدید' : 'پروژه ایجاد شد',
    ...(source === 'INTERNAL'
      ? { actorId, actorType: 'USER' }
      : {}),
  });

  const customerName =
    getCustomerPersonName({
      personName: brief.personName,
      companyName: brief.companyName,
    }) ||
    getCustomerPersonName(customer) ||
    'مشتری';

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

  const effectivePortalId =
    portalAccountId || customer.portalAccount?.id || null;
  if (notifyPortal && effectivePortalId) {
    await createNotificationOnce(
      {
        portalAccountId: effectivePortalId,
        audience: 'PORTAL',
        eventKey: `project.created.portal:${p.id}`,
        title: 'پروژه با موفقیت ایجاد شد',
        body: `${p.title} (${p.code}) آماده بررسی است.`,
        link: `/portal/projects/${p.id}`,
        meta: {
          type: 'PROJECT_CREATED',
          projectId: p.id,
          projectCode: p.code,
          projectName: p.title,
          statusLabel: 'اطلاعات دریافت شد',
        },
      },
      tx,
    );
  }

  return {
    project: p,
    opportunityId: opportunity.id,
    financeSnap: snap,
    agreedPrice: agreed,
  };
}
