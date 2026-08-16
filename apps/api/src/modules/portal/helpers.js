import { prisma } from '../../db/prisma.js';
import {
  buildProjectProgress,
  attachProjectProgress,
} from '../../services/projectProgress.js';
import { formatFaDateTime, formatFaTime } from '../../utils/datetime.js';
import { storedAssetUrl } from '../../services/storage/asset-url.js';

export function customerProjectWhere(auth) {
  return { crmCustomerId: auth.customerId, deletedAt: null };
}

/**
 * @deprecated Prefer buildProjectProgress().percent
 * Accepts customerFacingStatus string OR a project-like object.
 */
export function computeProjectProgress(statusOrProject) {
  if (statusOrProject && typeof statusOrProject === 'object') {
    return buildProjectProgress({
      status: statusOrProject.status,
      customerFacingStatus: statusOrProject.customerFacingStatus,
      audience: 'portal',
    }).percent;
  }
  return buildProjectProgress({
    customerFacingStatus: statusOrProject,
    audience: 'portal',
  }).percent;
}

export { formatFaDateTime, formatFaTime };

export function pickThumbnail(project) {
  const refs = project.assetRefs || project.assetReferences || [];
  for (const ref of refs) {
    const asset = ref.clientAsset;
    if (!asset || asset.deletedAt) continue;
    if (
      ['LOGO', 'PRODUCT_IMAGE'].includes(asset.kind)
      || asset.mimeType?.startsWith('image/')
    ) {
      return {
        storageKey: asset.storageKey,
        url: storedAssetUrl(asset.meta),
      };
    }
  }
  return null;
}

export function serializePortalAsset(asset) {
  if (!asset || asset.deletedAt) return null;
  return {
    id: asset.id,
    name: asset.name,
    kind: asset.kind,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    storageKey: asset.storageKey,
    url: storedAssetUrl(asset.meta),
    meta: asset.meta,
  };
}

export function serializePortalProjectSummary(project) {
  const budget = project.finance ? Number(project.finance.finalProjectPrice) : null;
  const progress = buildProjectProgress({
    status: project.status,
    customerFacingStatus: project.customerFacingStatus,
    audience: 'portal',
  });
  const thumb = pickThumbnail(project);
  return {
    id: project.id,
    code: project.code,
    title: project.title,
    status: project.customerFacingStatus,
    progress,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    deadlineAt: project.deadlineAt,
    budget,
    thumbnailStorageKey: thumb?.storageKey || null,
    thumbnailUrl: thumb?.url || null,
  };
}

export async function countPendingBriefs(customerId) {
  return prisma.opportunity.count({
    where: {
      crmCustomerId: customerId,
      deletedAt: null,
      projectId: null,
      pipelineStage: { notIn: ['CANCELED', 'COMPLETED'] },
    },
  });
}

export { attachProjectProgress, buildProjectProgress };
