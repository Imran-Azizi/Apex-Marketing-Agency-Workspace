import { prisma } from '../db/prisma.js';

export function mapProjectStatusToCustomer(status) {
  const map = {
    NEW_MANAGER_REVIEW: 'INFO_RECEIVED',
    CONTENT_GENERATION: 'PREPARING_CONTENT',
    INTERNAL_CONTENT_REVIEW: 'PREPARING_CONTENT',
    WAITING_CLIENT_CONTENT_APPROVAL: 'WAITING_YOUR_APPROVAL',
    CONTENT_REVISION: 'PREPARING_CONTENT',
    NARRATION_RECORDING: 'IN_PRODUCTION',
    PRODUCTION_EDITING: 'IN_PRODUCTION',
    MANAGER_FINAL_REVIEW: 'FINAL_REVIEW',
    FINAL_REVISION: 'FINAL_REVIEW',
    WAITING_CLIENT_FINAL_APPROVAL: 'WAITING_YOUR_APPROVAL',
    WAITING_PAYMENT: 'WAITING_PAYMENT',
    READY_TO_DOWNLOAD: 'READY_DELIVERY',
    COMPLETED: 'COMPLETED',
    ON_HOLD: 'INFO_RECEIVED',
    CANCELED: 'COMPLETED',
  };
  return map[status] || 'INFO_RECEIVED';
}

export async function rebuildProjectContext(projectId, tx = prisma) {
  const project = await tx.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: {
      crmCustomer: true,
      service: true,
      format: true,
      files: { where: { deletedAt: null } },
      contentVersions: { orderBy: { versionNumber: 'desc' }, take: 10 },
      feedback: { orderBy: { createdAt: 'desc' }, take: 20 },
      assignments: { where: { isActive: true }, include: { teamProfile: true } },
      assetRefs: { include: { clientAsset: true } },
    },
  });
  if (!project) return null;

  const contextJson = {
    projectId: project.id,
    code: project.code,
    customerId: project.crmCustomerId,
    status: project.status,
    customerFacingStatus: project.customerFacingStatus,
    managerId: project.managerId,
    deadlineAt: project.deadlineAt,
    brief: project.brief,
    durationSec: project.durationSec,
    format: project.format?.ratio,
    language: project.language,
    tone: project.tone,
    platforms: project.platforms,
    assignments: project.assignments.map((a) => ({
      role: a.role,
      displayName: a.teamProfile?.displayName,
    })),
    files: project.files.map((f) => ({
      id: f.id,
      kind: f.kind,
      name: f.name,
      storageKey: f.storageKey,
    })),
    assetRefs: project.assetRefs.map((r) => ({
      id: r.clientAssetId,
      name: r.clientAsset.name,
      kind: r.clientAsset.kind,
    })),
    contentVersions: project.contentVersions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      publishedToClient: v.publishedToClient,
      isLocked: v.isLocked,
    })),
    feedback: project.feedback.map((f) => ({ scope: f.scope, body: f.body, at: f.createdAt })),
    revisions: {
      contentUsed: project.contentRevisionUsed,
      contentMax: project.contentRevisionMax,
      videoUsed: project.videoRevisionUsed,
      videoMax: project.videoRevisionMax,
    },
  };

  const contextMd = [
    `# Project ${project.code}`,
    '',
    `- Status: ${project.status}`,
    `- Customer: ${project.crmCustomer.companyName || project.crmCustomer.personName}`,
    `- Duration: ${project.durationSec || '-'}s`,
    `- Language: ${project.language || '-'}`,
    '',
    '## Brief',
    '```json',
    JSON.stringify(project.brief || {}, null, 2),
    '```',
  ].join('\n');

  await tx.projectContext.upsert({
    where: { projectId },
    create: { projectId, contextJson, contextMd },
    update: { contextJson, contextMd },
  });

  return contextJson;
}

export function computeFinanceFields({ agreedPrice = 0, discount = 0, narratorCost = 0, editorCost = 0, otherDirectCosts = 0, received = 0 }) {
  const agreed = Number(agreedPrice);
  const disc = Number(discount);
  const finalProjectPrice = Math.max(agreed - disc, 0);
  const directCosts = Number(narratorCost) + Number(editorCost) + Number(otherDirectCosts);
  const balance = finalProjectPrice - Number(received);
  const profit = finalProjectPrice - directCosts;
  return { finalProjectPrice, directCosts, balance, profit };
}
