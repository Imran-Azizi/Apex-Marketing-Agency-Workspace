import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/response.js';
import {
  aiProvider,
  AGENT_PROMPTS,
  PROMPT_VERSION,
  normalizeScenarioOutput,
  normalizeNarrationOutput,
  normalizeStoryboardOutput,
  formatAiError,
  getActiveProviderInfo,
  sanitizeAiInput,
} from '../../services/ai/index.js';
import {
  attachStoryboardImages,
} from '../../services/ai/storyboard-images.js';
import { extractProjectBrandContext } from '../../services/ai/storyboard-image-prompt.js';
import { rebuildProjectContext } from '../../services/projectContext.js';
import { writeAudit } from '../../middleware/audit.js';
import { env, getActiveAiConfig } from '../../config/env.js';
import {
  createNotificationOnce,
  buildContentSentForApprovalNotification,
} from '../../services/notifications.js';
import {
  canManagerDeleteVersion,
  canManagerSendToCustomer,
  canToggleSectionConfirm,
  CONTENT_SECTIONS,
  getManagerSectionConfirm,
  versionHasSection,
  withManagerSectionConfirm,
} from '../../services/contentVersionRules.js';
import { narrationService } from '../narration/service.js';

export const AGENT_DEFINITIONS = [
  {
    code: 'SCENARIO',
    name: 'Scenario Agent',
    nameFa: 'عامل سناریو',
    description: 'One final professional video scenario with problem/solution flow and CTA',
    descriptionFa: 'یک سناریوی نهایی حرفه‌ای با ساختار مشکل/راه‌حل و CTA',
    sortOrder: 1,
  },
  {
    code: 'NARRATION',
    name: 'Narration Agent',
    nameFa: 'عامل نریشن',
    description: 'One production-ready voice-over script in the project language using the selected tone',
    descriptionFa: 'یک متن گویندگی نهایی آماده تولید به زبان و لحن انتخاب‌شده پروژه',
    sortOrder: 2,
  },
  {
    code: 'STORYBOARD',
    name: 'Storyboard & Prompt Agent',
    nameFa: 'عامل استوری‌بورد و پرامپت',
    description: 'One scene-by-scene storyboard with camera and transition notes',
    descriptionFa: 'یک استوری‌بورد صحنه به صحنه با دوربین و انتقال',
    sortOrder: 3,
  },
];

const PIPELINE_STEPS = [
  { key: 'read_project', label: 'خواندن اطلاعات پروژه', labelEn: 'Reading project information' },
  { key: 'scenario', label: 'تولید سناریو', labelEn: 'Generating scenario', agentType: 'SCENARIO' },
  { key: 'narration', label: 'ایجاد نریشن', labelEn: 'Creating narration', agentType: 'NARRATION' },
  { key: 'storyboard', label: 'ساخت استوری‌بورد', labelEn: 'Building storyboard', agentType: 'STORYBOARD' },
  { key: 'storyboard_images', label: 'تولید تصاویر استوری‌بورد', labelEn: 'Generating storyboard images' },
  { key: 'finalize', label: 'ذخیره نسخه محتوا', labelEn: 'Saving content version' },
];

const AGENT_STEP_KEY = {
  SCENARIO: 'scenario',
  NARRATION: 'narration',
  STORYBOARD: 'storyboard',
};

const USER_PROMPT_MAX_CHARS = 4000;

function normalizeUserPrompt(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, USER_PROMPT_MAX_CHARS);
}

function initSteps() {
  return PIPELINE_STEPS.map((s) => ({
    ...s,
    status: 'PENDING',
    startedAt: null,
    finishedAt: null,
    error: null,
  }));
}

function markStep(steps, key, patch) {
  return steps.map((s) => (s.key === key ? { ...s, ...patch } : s));
}

async function logActivity(projectId, { userId, action, entityType, entityId, message, meta }) {
  try {
    await prisma.aiActivityLog.create({
      data: {
        projectId,
        userId: userId || null,
        action,
        entityType: entityType || null,
        entityId: entityId || null,
        message: message || null,
        meta: meta || null,
      },
    });
  } catch {
    // non-blocking
  }
}

async function loadProjectInput(projectId) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: {
      context: {
        select: { contextJson: true, contextMd: true },
      },
      crmCustomer: {
        select: {
          personName: true,
          companyName: true,
          city: true,
        },
      },
      service: { select: { name: true } },
      format: { select: { ratio: true } },
      files: {
        where: { deletedAt: null },
        select: { id: true, kind: true, name: true, storageKey: true },
        take: 40,
      },
      assetRefs: {
        include: {
          clientAsset: {
            select: {
              id: true,
              kind: true,
              name: true,
              storageKey: true,
            },
          },
        },
        take: 40,
      },
      // sanitizeAiInput only keeps 2 summarized versions — avoid over-fetching.
      contentVersions: {
        orderBy: { versionNumber: 'desc' },
        take: 2,
        select: {
          id: true,
          versionNumber: true,
          status: true,
          publishedToClient: true,
          scenario: true,
          narration: true,
          storyboard: true,
          extras: true,
          createdAt: true,
        },
      },
      feedback: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          scope: true,
          body: true,
          createdAt: true,
        },
      },
      approvals: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          type: true,
          decision: true,
          comment: true,
          createdAt: true,
        },
      },
    },
  });
  if (!project) throw new AppError('پروژه یافت نشد', 404, 'NOT_FOUND');

  return {
    project,
    input: {
      projectId: project.id,
      code: project.code,
      title: project.title,
      status: project.status,
      brief: project.brief,
      context: project.context?.contextJson || null,
      contextMd: project.context?.contextMd || null,
      durationSec: project.durationSec,
      language: project.language,
      tone: project.tone,
      platforms: project.platforms,
      service: project.service?.name || null,
      format: project.format?.ratio || null,
      customer: {
        personName: project.crmCustomer?.personName || null,
        companyName: project.crmCustomer?.companyName || null,
        city: project.crmCustomer?.city || null,
      },
      assets: [
        ...project.files.map((f) => ({
          source: 'project_file',
          id: f.id,
          kind: f.kind,
          name: f.name,
          storageKey: f.storageKey,
        })),
        ...project.assetRefs
          .filter((r) => r.clientAsset)
          .map((r) => ({
            source: 'client_asset',
            id: r.clientAssetId,
            kind: r.clientAsset.kind,
            name: r.clientAsset.name,
            storageKey: r.clientAsset.storageKey,
          })),
      ],
      previousVersions: project.contentVersions,
      clientFeedback: project.feedback,
      approvals: project.approvals,
      managerNotes: project.brief?.managerNotes || null,
    },
  };
}

async function executePipelineJob({
  projectId,
  workflowId,
  auth,
  changeNotes,
  req,
  userPrompt = null,
  baseVersionId = null,
}) {
  let steps = initSteps();
  const touch = async (nextSteps, extra = {}) => {
    steps = nextSteps;
    return prisma.aiWorkflowExecution.update({
      where: { id: workflowId },
      data: { steps, ...extra },
    });
  };

  try {
    const { input, project } = await loadProjectInput(projectId);
    const normalizedPrompt = normalizeUserPrompt(userPrompt);

    if (normalizedPrompt) {
      input.userInstructions = normalizedPrompt;
      // Keep managerNotes aligned for older prompt templates / logs
      input.managerNotes = [input.managerNotes, normalizedPrompt].filter(Boolean).join('\n\n');
    }

    if (baseVersionId) {
      const baseVersion = await prisma.contentVersion.findFirst({
        where: { id: baseVersionId, projectId },
        select: {
          id: true,
          versionNumber: true,
          scenario: true,
          narration: true,
          storyboard: true,
        },
      });
      if (!baseVersion) {
        throw new AppError('نسخه پایه برای ویرایش یافت نشد', 404, 'NOT_FOUND');
      }
      input.priorOutputs = {
        scenario: baseVersion.scenario || null,
        narration: baseVersion.narration || null,
        storyboard: baseVersion.storyboard || null,
      };
      input.revisionOfVersionId = baseVersion.id;
      input.revisionOfVersionNumber = baseVersion.versionNumber;
      if (normalizedPrompt) {
        input.userInstructions = [
          `Revise the provided priorOutputs (version ${baseVersion.versionNumber}) according to these manager edit instructions.`,
          'Preserve strong existing ideas unless the instructions ask to change them.',
          normalizedPrompt,
        ].join('\n');
      }
    }

    await touch(
      markStep(steps, 'read_project', {
        status: 'RUNNING',
        startedAt: new Date().toISOString(),
      }),
    );
    await touch(
      markStep(steps, 'read_project', {
        status: 'COMPLETED',
        finishedAt: new Date().toISOString(),
      }),
    );

    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'CONTENT_GENERATION',
        customerFacingStatus: 'PREPARING_CONTENT',
      },
    });

    const agents = await prisma.aiAgent.findMany({ where: { status: 'ACTIVE' } });
    const agentTemplates = Object.fromEntries(
      agents.filter((a) => a.promptTemplate).map((a) => [a.code, a.promptTemplate]),
    );

    const runByAgent = {};
    let pipelineWarning = null;

    const pipeline = await aiProvider.generatePipeline({
      input,
      promptVersion: PROMPT_VERSION,
      agentTemplates,
      onStep: async ({ agentType, status, result, key, error, code }) => {
        const stepKey = AGENT_STEP_KEY[agentType];
        if (!stepKey) return;

        if (status === 'RUNNING') {
          await touch(
            markStep(steps, stepKey, {
              status: 'RUNNING',
              startedAt: new Date().toISOString(),
              error: null,
            }),
          );
          return;
        }

        if (status === 'FAILED') {
          const failMessage = error || 'تولید ناموفق بود';
          const failedRun = await prisma.aiRun.create({
            data: {
              projectId,
              workflowId,
              agentType,
              promptVersion: PROMPT_VERSION,
              model: getActiveAiConfig().reasoningModel || 'unknown',
              input: sanitizeAiInput(input),
              output: null,
              tokenUsage: null,
              durationMs: null,
              status: 'FAILED',
              startedAt: new Date(),
              finishedAt: new Date(),
              userId: auth.userId,
              error: failMessage,
            },
          });
          runByAgent[agentType] = failedRun.id;
          await touch(
            markStep(steps, stepKey, {
              status: 'FAILED',
              finishedAt: new Date().toISOString(),
              error: failMessage,
            }),
          );
          await logActivity(projectId, {
            userId: auth.userId,
            action: 'AI_AGENT_FAILED',
            entityType: 'AiRun',
            entityId: failedRun.id,
            message: `${agentType}: ${failMessage}`,
            meta: { key, code: code || null, provider: getActiveProviderInfo().id },
          });
          return;
        }

        if (status === 'COMPLETED' && result) {
          if (result.fallbackError && !pipelineWarning) {
            pipelineWarning = result.fallbackError;
          }

          const run = await prisma.aiRun.create({
            data: {
              projectId,
              workflowId,
              agentType,
              promptVersion: result.promptVersion || PROMPT_VERSION,
              model: result.model || 'apex-ai',
              input: sanitizeAiInput(input),
              output: result.output || null,
              tokenUsage: result.tokenUsage || null,
              durationMs: result.durationMs ?? null,
              status: result.output ? 'COMPLETED' : 'FAILED',
              startedAt: new Date(Date.now() - (result.durationMs || 0)),
              finishedAt: new Date(),
              userId: auth.userId,
              error: result.usedFallback ? result.fallbackError || 'mock-fallback' : null,
            },
          });
          runByAgent[agentType] = run.id;

          await touch(
            markStep(steps, stepKey, {
              status: result.output ? 'COMPLETED' : 'FAILED',
              finishedAt: new Date().toISOString(),
              warning: result.usedFallback || false,
              error: result.output ? null : result.fallbackError || 'No output',
            }),
          );

          await logActivity(projectId, {
            userId: auth.userId,
            action: result.usedFallback ? 'AI_AGENT_FALLBACK' : 'AI_AGENT_COMPLETED',
            entityType: 'AiRun',
            entityId: run.id,
            message: result.usedFallback
              ? `${agentType}: خروجی آزمایشی (سرویس AI در دسترس نبود)`
              : `${agentType} تکمیل شد`,
            meta: {
              key,
              feature: agentType,
              model: result.model,
              provider: result.provider,
              tokens: result.tokenUsage,
              fallbackCode: result.fallbackCode || null,
            },
          });
        }
      },
    });

    // Attach a single pipeline-level warning once (not on every step)
    if (pipeline.fallbackError || pipelineWarning) {
      await prisma.aiWorkflowExecution.update({
        where: { id: workflowId },
        data: {
          error: pipeline.fallbackError || pipelineWarning,
        },
      });
    }

    const outputs = pipeline.outputs || {};

    await touch(
      markStep(steps, 'storyboard_images', {
        status: 'RUNNING',
        startedAt: new Date().toISOString(),
      }),
    );

    let storyboardOutput = outputs.storyboard || null;
    let storyboardImagesMeta = null;
    if (storyboardOutput) {
      try {
        storyboardOutput = await attachStoryboardImages(storyboardOutput, {
          projectId,
          scenario: outputs.scenario || null,
          narration: outputs.narration || null,
          projectContext: extractProjectBrandContext(project || {}),
        });
        storyboardImagesMeta = storyboardOutput.imagesMeta || null;
        delete storyboardOutput.imagesMeta;
        const imageWarning = storyboardOutput.collageImageError || null;
        await touch(
          markStep(steps, 'storyboard_images', {
            status: storyboardOutput.collageImageUrl ? 'COMPLETED' : 'COMPLETED',
            finishedAt: new Date().toISOString(),
            warning: Boolean(imageWarning),
            error: imageWarning,
          }),
        );
      } catch (imgErr) {
        console.warn('[AI storyboard images]', imgErr.message);
        await touch(
          markStep(steps, 'storyboard_images', {
            status: 'COMPLETED',
            finishedAt: new Date().toISOString(),
            warning: true,
            error: imgErr.message || 'تولید تصاویر صحنه‌ها ناموفق بود',
          }),
        );
      }
    } else {
      await touch(
        markStep(steps, 'storyboard_images', {
          status: 'COMPLETED',
          finishedAt: new Date().toISOString(),
        }),
      );
    }

    await touch(
      markStep(steps, 'finalize', {
        status: 'RUNNING',
        startedAt: new Date().toISOString(),
      }),
    );

    const last = await prisma.contentVersion.findFirst({
      where: { projectId, kind: 'BUNDLE' },
      orderBy: { versionNumber: 'desc' },
    });
    const versionNumber = (last?.versionNumber || 0) + 1;

    const version = await prisma.contentVersion.create({
      data: {
        projectId,
        kind: 'BUNDLE',
        versionNumber,
        scenario: outputs.scenario || null,
        narration: outputs.narration || null,
        storyboard: storyboardOutput,
        extras: {
          provider: pipeline.provider,
          model: pipeline.model,
          promptVersion: pipeline.promptVersion || PROMPT_VERSION,
          totalTokens: pipeline.totalTokens || 0,
          usedFallback: pipeline.usedFallback || false,
          fallbackCode: pipeline.fallbackCode || null,
          fallbackNotice: pipeline.fallbackError || null,
          userInstructions: normalizedPrompt || null,
          revisionOfVersionId: baseVersionId || null,
          storyboardImages: storyboardImagesMeta,
          stepResults: (pipeline.steps || []).map((s) => ({
            agentType: s.agentType,
            feature: s.feature || s.agentType,
            model: s.model,
            provider: s.provider,
            durationMs: s.durationMs,
            tokenUsage: s.tokenUsage || null,
            usedFallback: s.usedFallback,
            fallbackCode: s.fallbackCode,
          })),
        },
        status: 'DRAFT',
        publishedToClient: false,
        createdById: auth.userId,
        aiRunId: runByAgent.SCENARIO || runByAgent.NARRATION || runByAgent.STORYBOARD || null,
        workflowId,
        changeNotes:
          changeNotes ||
          (baseVersionId
            ? normalizedPrompt
              ? `ویرایش با هوش مصنوعی: ${normalizedPrompt.slice(0, 120)}`
              : 'ویرایش با هوش مصنوعی'
            : versionNumber > 1
              ? 'بازتولید توسط هوش مصنوعی'
              : 'تولید اولیه توسط هوش مصنوعی'),
      },
    });

    await touch(
      markStep(steps, 'finalize', {
        status: 'COMPLETED',
        finishedAt: new Date().toISOString(),
      }),
      {
        status: 'COMPLETED',
        contentVersionId: version.id,
        finishedAt: new Date(),
      },
    );

    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'INTERNAL_CONTENT_REVIEW',
        customerFacingStatus: 'PREPARING_CONTENT',
      },
    });
    await rebuildProjectContext(projectId);

    await writeAudit({
      userId: auth.userId,
      action: 'AI_CONTENT_GENERATE',
      entityType: 'ContentVersion',
      entityId: version.id,
      after: { versionNumber, projectId, workflowId },
      req,
    });

    await logActivity(projectId, {
      userId: auth.userId,
      action: 'AI_PIPELINE_COMPLETED',
      entityType: 'ContentVersion',
      entityId: version.id,
      message: `نسخه ${versionNumber} تولید شد`,
      meta: { workflowId, provider: pipeline.provider, totalTokens: pipeline.totalTokens },
    });

    return { workflowId, version };
  } catch (err) {
    const info = formatAiError(err, getActiveProviderInfo().id);
    const message = info.messageFa || err.messageFa || err.message || 'تولید محتوا ناموفق بود';
    await prisma.aiWorkflowExecution.update({
      where: { id: workflowId },
      data: {
        status: 'FAILED',
        error: message,
        steps: markStep(steps, steps.find((s) => s.status === 'RUNNING')?.key || 'finalize', {
          status: 'FAILED',
          error: message,
          finishedAt: new Date().toISOString(),
        }),
        finishedAt: new Date(),
      },
    });

    await logActivity(projectId, {
      userId: auth.userId,
      action: 'AI_PIPELINE_FAILED',
      entityType: 'AiWorkflowExecution',
      entityId: workflowId,
      message,
      meta: { code: info.code || err.code || null, provider: getActiveProviderInfo().id },
    });

    throw err;
  }
}

export const aiService = {
  _agentsSeededAt: 0,
  _agentsSeededVersion: null,

  async ensureAgentsSeeded() {
    // Avoid re-upserting on every overview poll — prompts only change with PROMPT_VERSION.
    if (
      this._agentsSeededVersion === PROMPT_VERSION &&
      Date.now() - this._agentsSeededAt < 10 * 60 * 1000
    ) {
      return;
    }

    for (const def of AGENT_DEFINITIONS) {
      const prompt = AGENT_PROMPTS[def.code];
      await prisma.aiAgent.upsert({
        where: { code: def.code },
        create: {
          code: def.code,
          name: def.name,
          nameFa: def.nameFa,
          description: def.description,
          descriptionFa: def.descriptionFa,
          status: 'ACTIVE',
          promptTemplate: prompt?.system || null,
          promptVersion: PROMPT_VERSION,
          config: {
            modelTier: prompt?.modelTier || 'reasoning',
          },
          sortOrder: def.sortOrder,
        },
        update: {
          name: def.name,
          nameFa: def.nameFa,
          description: def.description,
          descriptionFa: def.descriptionFa,
          status: 'ACTIVE',
          sortOrder: def.sortOrder,
          promptTemplate: prompt?.system || undefined,
          promptVersion: PROMPT_VERSION,
          config: {
            modelTier: prompt?.modelTier || 'reasoning',
          },
        },
      });
    }

    // Remove obsolete agents that are no longer part of the content pipeline.
    try {
      await prisma.$executeRawUnsafe(`
        DELETE FROM "ai_agents"
        WHERE "code"::text IN (
          'SALES_ASSISTANT', 'INTAKE', 'QC', 'PROJECT_ASSISTANT'
        )
      `);
    } catch {
      // Enum may already exclude obsolete codes after migration.
    }

    const activeAi = getActiveAiConfig();
    await prisma.aiSetting.upsert({
      where: { key: 'models' },
      create: {
        key: 'models',
        value: {
          reasoning: activeAi.reasoningModel,
          light: activeAi.lightModel,
          image: activeAi.imageModel,
          sora: env.openaiSoraModel,
          provider: activeAi.provider,
        },
      },
      update: {
        value: {
          reasoning: activeAi.reasoningModel,
          light: activeAi.lightModel,
          image: activeAi.imageModel,
          sora: env.openaiSoraModel,
          provider: activeAi.provider,
        },
      },
    });

    this._agentsSeededVersion = PROMPT_VERSION;
    this._agentsSeededAt = Date.now();
  },

  async getOverview(projectId) {
    await this.ensureAgentsSeeded();
    const [project, lastWorkflow, versions, running, feedback, approvals] =
      await Promise.all([
        prisma.project.findUnique({
          where: { id: projectId },
          select: { id: true, language: true, tone: true, title: true },
        }),
        prisma.aiWorkflowExecution.findFirst({
          where: { projectId },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.contentVersion.count({ where: { projectId } }),
        prisma.aiWorkflowExecution.findFirst({
          where: { projectId, status: { in: ['PENDING', 'RUNNING'] } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.clientFeedback.findMany({
          where: { projectId, scope: 'CONTENT' },
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            contentVersion: {
              select: { id: true, versionNumber: true, status: true },
            },
          },
        }),
        prisma.approval.findMany({
          where: {
            projectId,
            type: { in: ['MANAGER_CONTENT', 'CLIENT_CONTENT'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      ]);

    if (!project) throw new AppError('پروژه یافت نشد', 404, 'NOT_FOUND');

    return {
      lastExecution: lastWorkflow,
      currentWorkflow: running,
      processingStatus: running?.status || lastWorkflow?.status || 'IDLE',
      generatedContentCount: versions,
      pipelineSteps: PIPELINE_STEPS,
      customerFeedback: feedback,
      approvalTimeline: approvals,
      projectLanguage: project.language || 'fa',
      projectTone: project.tone || '',
      projectTitle: project.title || null,
    };
  },

  async listRuns(projectId, { take = 50 } = {}) {
    return prisma.aiRun.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
  },

  async listWorkflows(projectId, { take = 20 } = {}) {
    return prisma.aiWorkflowExecution.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        runs: { orderBy: { createdAt: 'asc' } },
      },
    });
  },

  async getWorkflow(workflowId) {
    const wf = await prisma.aiWorkflowExecution.findUnique({
      where: { id: workflowId },
      include: { runs: { orderBy: { createdAt: 'asc' } } },
    });
    if (!wf) throw new AppError('اجرای ورک‌فلو یافت نشد', 404, 'NOT_FOUND');
    return wf;
  },

  async listVersions(projectId) {
    const rows = await prisma.contentVersion.findMany({
      where: { projectId },
      orderBy: { versionNumber: 'desc' },
      include: {
        feedback: {
          where: { scope: 'CONTENT' },
          orderBy: { createdAt: 'desc' },
        },
        approvals: { orderBy: { createdAt: 'desc' } },
      },
    });
    return rows.map(withManagerSectionConfirm);
  },

  async getVersion(projectId, versionId) {
    const version = await prisma.contentVersion.findFirst({
      where: { id: versionId, projectId },
      include: { approvals: { orderBy: { createdAt: 'desc' } } },
    });
    if (!version) throw new AppError('نسخه یافت نشد', 404, 'NOT_FOUND');
    return withManagerSectionConfirm(version);
  },

  async compareVersions(projectId, leftId, rightId) {
    const [left, right] = await Promise.all([
      this.getVersion(projectId, leftId),
      this.getVersion(projectId, rightId),
    ]);
    return { left, right };
  },

  /**
   * Full "Generate Content" pipeline — always creates a NEW content version.
   * Runs async by default so the UI can poll workflow progress.
   * Optional userPrompt is high-priority creative / edit guidance for the agents.
   * Optional baseVersionId loads that version as priorOutputs for guided revision.
   */
  async generateContent(
    projectId,
    auth,
    req,
    { changeNotes, sync, userPrompt, baseVersionId } = {},
  ) {
    await this.ensureAgentsSeeded();
    const existingRunning = await prisma.aiWorkflowExecution.findFirst({
      where: { projectId, status: { in: ['PENDING', 'RUNNING'] } },
    });
    if (existingRunning) {
      throw new AppError('یک اجرای هوش مصنوعی در حال انجام است', 409, 'AI_BUSY');
    }

    const normalizedPrompt = normalizeUserPrompt(userPrompt);
    const steps = initSteps();
    const workflow = await prisma.aiWorkflowExecution.create({
      data: {
        projectId,
        status: 'RUNNING',
        steps,
        triggeredById: auth.userId,
        startedAt: new Date(),
      },
    });

    await logActivity(projectId, {
      userId: auth.userId,
      action: 'AI_PIPELINE_STARTED',
      entityType: 'AiWorkflowExecution',
      entityId: workflow.id,
      message: baseVersionId ? 'شروع ویرایش محتوا با هوش مصنوعی' : 'شروع تولید محتوا',
      meta: {
        changeNotes: changeNotes || null,
        userPrompt: normalizedPrompt,
        baseVersionId: baseVersionId || null,
      },
    });

    const runSync = sync === true || env.aiAsyncPipeline === false;
    const jobArgs = {
      projectId,
      workflowId: workflow.id,
      auth,
      changeNotes,
      req,
      userPrompt: normalizedPrompt,
      baseVersionId: baseVersionId || null,
    };

    if (runSync) {
      const result = await executePipelineJob(jobArgs);
      return {
        workflow: await this.getWorkflow(workflow.id),
        version: result.version,
        async: false,
      };
    }

    setImmediate(() => {
      executePipelineJob(jobArgs).catch((err) => {
        console.error(
          '[AI pipeline]',
          workflow.id,
          err.status || '',
          err.code || '',
          err.message,
          String(err.body || '').slice(0, 180),
        );
      });
    });

    return {
      workflow: await this.getWorkflow(workflow.id),
      version: null,
      async: true,
      message: baseVersionId
        ? 'ویرایش محتوا در پس‌زمینه شروع شد'
        : 'تولید محتوا در پس‌زمینه شروع شد',
    };
  },

  async createManualVersion(
    projectId,
    { scenario, narration, storyboard, extras, sourceFiles } = {},
    auth,
    req,
  ) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, language: true, tone: true },
    });
    if (!project) throw new AppError('پروژه یافت نشد', 404, 'NOT_FOUND');

    const langToneContext = {
      language: project.language || 'fa',
      tone: project.tone || '',
    };

    const hasScenario = scenario != null;
    const hasNarration = narration != null;
    const hasStoryboard = storyboard != null;
    if (!hasScenario && !hasNarration && !hasStoryboard) {
      throw new AppError(
        'حداقل یکی از بخش‌های سناریو، نریشن یا استوری‌بورد لازم است',
        400,
        'VALIDATION',
      );
    }

    const isExactManual = (value) =>
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      value.preserveExact === true &&
      typeof value.manualRaw === 'string';

    const preserveExactPayload = (value, projectId, label) => {
      const raw = value.manualRaw;
      // Allow empty raw for image-only storyboard (manualRaw === '')
      if (label !== 'استوری‌بورد' && (!raw || !String(raw).trim())) {
        throw new AppError(`محتوای ${label} خالی است`, 400, 'VALIDATION');
      }
      if (
        label === 'استوری‌بورد' &&
        !String(raw || '').trim() &&
        !(Array.isArray(value.uploadedImages) && value.uploadedImages.length) &&
        !(Array.isArray(value.storyboard) && value.storyboard.length) &&
        !(Array.isArray(value.scenes) && value.scenes.length)
      ) {
        throw new AppError('محتوای استوری‌بورد خالی است', 400, 'VALIDATION');
      }
      return {
        ...value,
        projectId: value.projectId || projectId,
        preserveExact: true,
        manualRaw: typeof raw === 'string' ? raw : '',
      };
    };

    const normalizeOrThrow = (fn, value, label) => {
      try {
        return fn(value, projectId, langToneContext);
      } catch (err) {
        throw new AppError(
          `محتوای ${label} نامعتبر است`,
          400,
          'VALIDATION',
          { cause: err?.message || null },
        );
      }
    };

    const nextScenario = hasScenario
      ? isExactManual(scenario)
        ? preserveExactPayload(scenario, projectId, 'سناریو')
        : normalizeOrThrow(normalizeScenarioOutput, scenario, 'سناریو')
      : null;
    const nextNarration = hasNarration
      ? isExactManual(narration)
        ? preserveExactPayload(narration, projectId, 'نریشن')
        : normalizeOrThrow(normalizeNarrationOutput, narration, 'نریشن')
      : null;
    const nextStoryboard = hasStoryboard
      ? isExactManual(storyboard)
        ? preserveExactPayload(storyboard, projectId, 'استوری‌بورد')
        : normalizeOrThrow(normalizeStoryboardOutput, storyboard, 'استوری‌بورد')
      : null;

    const last = await prisma.contentVersion.findFirst({
      where: { projectId, kind: 'BUNDLE' },
      orderBy: { versionNumber: 'desc' },
    });
    const versionNumber = (last?.versionNumber || 0) + 1;

    const fileMeta = Array.isArray(sourceFiles)
      ? sourceFiles
          .filter((f) => f && typeof f === 'object')
          .map((f) => ({
            section: typeof f.section === 'string' ? f.section : null,
            name: typeof f.name === 'string' ? f.name : null,
            mimeType: typeof f.mimeType === 'string' ? f.mimeType : null,
            sizeBytes: Number(f.sizeBytes) || null,
            storageKey: typeof f.storageKey === 'string' ? f.storageKey : null,
            url: typeof f.url === 'string' ? f.url : null,
            inputMethod:
              f.inputMethod === 'text' ||
              f.inputMethod === 'file' ||
              f.inputMethod === 'image'
                ? f.inputMethod
                : null,
          }))
      : [];

    const baseExtras =
      extras && typeof extras === 'object' && !Array.isArray(extras) ? extras : {};

    const usedText = fileMeta.some((f) => f.inputMethod === 'text');
    const usedImage = fileMeta.some((f) => f.inputMethod === 'image');
    const usedFile = fileMeta.some(
      (f) => f.inputMethod === 'file' || (f.inputMethod == null && f.name),
    );
    const changeNotes = [
      usedText ? 'متن' : null,
      usedFile ? 'فایل' : null,
      usedImage ? 'تصویر' : null,
    ]
      .filter(Boolean)
      .join(' و ');
    const changeNotesLabel = changeNotes
      ? `ورود دستی محتوا از ${changeNotes} — تأیید خودکار`
      : 'ورود دستی محتوا — تأیید خودکار';

    const approvedAt = new Date();

    const version = await prisma.$transaction(async (tx) => {
      // Supersede any active customer-pending versions — manual entry is the new source of truth.
      await tx.contentVersion.updateMany({
        where: {
          projectId,
          kind: 'BUNDLE',
          status: 'PENDING_CUSTOMER_APPROVAL',
          publishedToClient: true,
        },
        data: { publishedToClient: false, status: 'SUPERSEDED' },
      });

      const created = await tx.contentVersion.create({
        data: {
          projectId,
          kind: 'BUNDLE',
          versionNumber,
          scenario: nextScenario,
          narration: nextNarration,
          storyboard: nextStoryboard,
          extras: {
            ...baseExtras,
            source: 'manual_upload',
            autoApproved: true,
            sourceFiles: fileMeta,
          },
          status: 'APPROVED',
          isLocked: true,
          publishedToClient: true,
          publishedAt: approvedAt,
          approvedById: auth.userId,
          createdById: auth.userId,
          changeNotes: changeNotesLabel,
        },
      });

      await tx.approval.create({
        data: {
          projectId,
          contentVersionId: created.id,
          type: 'MANAGER_CONTENT',
          decision: 'APPROVED',
          comment:
            'تأیید خودکار پس از ورود دستی سناریو / نریشن / استوری‌بورد — بدون نیاز به تأیید مشتری',
          actorType: 'MANAGER',
          actorId: auth.userId,
        },
      });

      await tx.project.update({
        where: { id: projectId },
        data: {
          status: 'NARRATION_RECORDING',
          customerFacingStatus: 'IN_PRODUCTION',
        },
      });

      await narrationService.ensureTaskForProject(projectId, {
        tx,
        contentVersionId: created.id,
        assignedById: auth.userId,
      });

      await tx.projectTimelineEvent.create({
        data: {
          projectId,
          type: 'CONTENT_MANUAL_AUTO_APPROVED',
          title: 'تأیید خودکار محتوای دستی',
          body: `نسخه ${versionNumber} پس از ورود دستی تأیید شد و آماده مراحل بعدی است`,
          actorId: auth.userId,
        },
      });

      await rebuildProjectContext(projectId, tx);
      return created;
    });

    await writeAudit({
      userId: auth.userId,
      action: 'AI_CONTENT_MANUAL_UPLOAD',
      entityType: 'ContentVersion',
      entityId: version.id,
      after: {
        versionNumber,
        projectId,
        source: 'manual_upload',
        status: 'APPROVED',
        autoApproved: true,
      },
      req,
    });

    await logActivity(projectId, {
      userId: auth.userId,
      action: 'CONTENT_MANUAL_UPLOAD',
      entityType: 'ContentVersion',
      entityId: version.id,
      message: `نسخه ${versionNumber} با ورود دستی ایجاد و به‌صورت خودکار تأیید شد`,
      meta: {
        versionNumber,
        autoApproved: true,
        sections: {
          scenario: Boolean(nextScenario),
          narration: Boolean(nextNarration),
          storyboard: Boolean(nextStoryboard),
        },
        fileCount: fileMeta.length,
      },
    });

    return version;
  },

  async createEditedVersion(
    projectId,
    { baseVersionId, section, scenario, narration, storyboard, changeNotes } = {},
    auth,
    req,
  ) {
    const allowed = new Set(['scenario', 'narration', 'storyboard']);
    if (!allowed.has(section)) {
      throw new AppError('بخش ویرایش نامعتبر است', 400, 'VALIDATION');
    }
    if (!baseVersionId) {
      throw new AppError('نسخه پایه لازم است', 400, 'VALIDATION');
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, language: true, tone: true },
    });
    if (!project) throw new AppError('پروژه یافت نشد', 404, 'NOT_FOUND');

    const langToneContext = {
      language: project.language || 'fa',
      tone: project.tone || '',
    };

    const base = await prisma.contentVersion.findFirst({
      where: { id: baseVersionId, projectId, kind: 'BUNDLE' },
    });
    if (!base) throw new AppError('نسخه پایه یافت نشد', 404, 'NOT_FOUND');

    const isExactManual = (value) =>
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      value.preserveExact === true &&
      typeof value.manualRaw === 'string';

    const preserveExactPayload = (value, pid, label) => {
      const raw = value.manualRaw;
      if (label !== 'استوری‌بورد' && (!raw || !String(raw).trim())) {
        throw new AppError(`محتوای ${label} خالی است`, 400, 'VALIDATION');
      }
      return {
        ...value,
        projectId: value.projectId || pid,
        preserveExact: true,
        manualRaw: typeof raw === 'string' ? raw : '',
      };
    };

    const normalizeOrThrow = (fn, value, label) => {
      try {
        return fn(value, projectId, langToneContext);
      } catch (err) {
        throw new AppError(`محتوای ${label} نامعتبر است`, 400, 'VALIDATION', {
          cause: err?.message || null,
        });
      }
    };

    let nextScenario = base.scenario;
    let nextNarration = base.narration;
    let nextStoryboard = base.storyboard;

    if (section === 'scenario') {
      if (scenario == null) {
        throw new AppError('محتوای سناریو لازم است', 400, 'VALIDATION');
      }
      nextScenario = isExactManual(scenario)
        ? preserveExactPayload(scenario, projectId, 'سناریو')
        : normalizeOrThrow(normalizeScenarioOutput, scenario, 'سناریو');
    } else if (section === 'narration') {
      if (narration == null) {
        throw new AppError('محتوای نریشن لازم است', 400, 'VALIDATION');
      }
      nextNarration = isExactManual(narration)
        ? preserveExactPayload(narration, projectId, 'نریشن')
        : normalizeOrThrow(normalizeNarrationOutput, narration, 'نریشن');
    } else if (section === 'storyboard') {
      if (storyboard == null) {
        throw new AppError('محتوای استوری‌بورد لازم است', 400, 'VALIDATION');
      }
      nextStoryboard = isExactManual(storyboard)
        ? preserveExactPayload(storyboard, projectId, 'استوری‌بورد')
        : normalizeOrThrow(normalizeStoryboardOutput, storyboard, 'استوری‌بورد');
    }

    const last = await prisma.contentVersion.findFirst({
      where: { projectId, kind: 'BUNDLE' },
      orderBy: { versionNumber: 'desc' },
    });
    const versionNumber = (last?.versionNumber || 0) + 1;
    const sectionLabel =
      section === 'scenario'
        ? 'سناریو'
        : section === 'narration'
          ? 'نریشن'
          : 'استوری‌بورد';
    const notes =
      String(changeNotes || '').trim() ||
      `ویرایش دستی ${sectionLabel} بر اساس نسخه ${base.versionNumber}`;

    const baseExtras =
      base.extras && typeof base.extras === 'object' && !Array.isArray(base.extras)
        ? base.extras
        : {};
    const { managerSectionConfirm: _priorConfirm, ...restExtras } = baseExtras;

    const version = await prisma.$transaction(async (tx) => {
      const created = await tx.contentVersion.create({
        data: {
          projectId,
          kind: 'BUNDLE',
          versionNumber,
          scenario: nextScenario,
          narration: nextNarration,
          storyboard: nextStoryboard,
          extras: {
            ...restExtras,
            source: 'manual_edit',
            editedSection: section,
            baseVersionId: base.id,
            baseVersionNumber: base.versionNumber,
          },
          status: 'EDITED',
          isLocked: false,
          publishedToClient: false,
          createdById: auth.userId,
          changeNotes: notes,
        },
      });

      await tx.projectTimelineEvent.create({
        data: {
          projectId,
          type: 'CONTENT_MANUAL_EDITED',
          title: `ویرایش دستی ${sectionLabel}`,
          body: `نسخه ${versionNumber} از ویرایش ${sectionLabel} نسخه ${base.versionNumber} ایجاد شد`,
          actorId: auth.userId,
        },
      });

      await rebuildProjectContext(projectId, tx);
      return created;
    });

    await writeAudit({
      userId: auth.userId,
      action: 'AI_CONTENT_MANUAL_EDIT',
      entityType: 'ContentVersion',
      entityId: version.id,
      after: {
        versionNumber,
        projectId,
        section,
        baseVersionId: base.id,
        status: 'EDITED',
      },
      req,
    });

    return version;
  },

  async deleteVersion(projectId, versionId, auth, req) {
    const version = await prisma.contentVersion.findFirst({
      where: { id: versionId, projectId },
    });
    if (!version) throw new AppError('نسخه یافت نشد', 404, 'NOT_FOUND');
    if (!canManagerDeleteVersion(version)) {
      throw new AppError(
        'نسخه ارسال‌شده یا تأییدشده برای مشتری قابل حذف نیست',
        400,
        'LOCKED',
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.approval.deleteMany({ where: { contentVersionId: versionId } });
      await tx.clientFeedback.updateMany({
        where: { contentVersionId: versionId },
        data: { contentVersionId: null },
      });
      await tx.aiWorkflowExecution.updateMany({
        where: { contentVersionId: versionId },
        data: { contentVersionId: null },
      });
      await tx.contentVersion.delete({ where: { id: versionId } });
    });

    await writeAudit({
      userId: auth.userId,
      action: 'AI_CONTENT_DELETE',
      entityType: 'ContentVersion',
      entityId: versionId,
      after: { versionNumber: version.versionNumber },
      req,
    });

    await logActivity(projectId, {
      userId: auth.userId,
      action: 'AI_CONTENT_DELETE',
      entityType: 'ContentVersion',
      entityId: versionId,
      message: `حذف نسخه ${version.versionNumber}`,
      meta: { versionNumber: version.versionNumber },
    });

    return { deleted: true, id: versionId };
  },

  async approveVersion(projectId, versionId, auth, req) {
    const version = await prisma.contentVersion.findFirst({
      where: { id: versionId, projectId },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            code: true,
            portalAccountId: true,
            crmCustomer: { select: { portalAccount: { select: { id: true } } } },
          },
        },
      },
    });
    if (!version) throw new AppError('نسخه یافت نشد', 404, 'NOT_FOUND');
    if (!canManagerSendToCustomer(version)) {
      if (version.status === 'APPROVED' && version.isLocked) {
        throw new AppError('این نسخه قبلاً تأیید شده است', 400, 'ALREADY_APPROVED');
      }
      if (version.status === 'PENDING_CUSTOMER_APPROVAL' && version.publishedToClient) {
        throw new AppError('این نسخه هم‌اکنون در انتظار تأیید مشتری است', 400, 'ALREADY_PENDING');
      }
      throw new AppError('محتوای قابل ارسال وجود ندارد', 400, 'EMPTY_CONTENT');
    }

    const sentAt = new Date();

    await prisma.$transaction(async (tx) => {
      // Only replace the active customer-facing pending version — keep approved history intact.
      await tx.contentVersion.updateMany({
        where: {
          projectId,
          kind: version.kind,
          id: { not: versionId },
          status: 'PENDING_CUSTOMER_APPROVAL',
          publishedToClient: true,
        },
        data: { publishedToClient: false, status: 'SUPERSEDED' },
      });

      await tx.contentVersion.updateMany({
        where: {
          projectId,
          kind: version.kind,
          id: { not: versionId },
          status: 'REVISION_REQUESTED',
          publishedToClient: true,
        },
        data: { publishedToClient: false },
      });

      await tx.contentVersion.update({
        where: { id: versionId },
        data: {
          status: 'PENDING_CUSTOMER_APPROVAL',
          publishedToClient: true,
          publishedAt: sentAt,
          approvedById: auth.userId,
          isLocked: false,
          rejectionReason: null,
          rejectedById: null,
        },
      });

      await tx.approval.create({
        data: {
          projectId,
          contentVersionId: versionId,
          type: 'MANAGER_CONTENT',
          decision: 'APPROVED',
          comment: 'ارسال برای تأیید مشتری',
          actorType: 'MANAGER',
          actorId: auth.userId,
        },
      });

      await tx.project.update({
        where: { id: projectId },
        data: {
          status: 'WAITING_CLIENT_CONTENT_APPROVAL',
          customerFacingStatus: 'WAITING_YOUR_APPROVAL',
        },
      });

      await tx.projectTimelineEvent.create({
        data: {
          projectId,
          type: 'CONTENT_SENT_FOR_APPROVAL',
          title: 'ارسال محتوا برای تأیید مشتری',
          body: `نسخه ${version.versionNumber}`,
          actorId: auth.userId,
        },
      });
    });

    const portalAccountId =
      version.project.portalAccountId ||
      version.project.crmCustomer?.portalAccount?.id ||
      null;

    if (portalAccountId) {
      // Single portal notification for this action (progress hook skips this status).
      await createNotificationOnce({
        ...buildContentSentForApprovalNotification({
          projectId,
          projectTitle: version.project.title,
          projectCode: version.project.code,
          versionNumber: version.versionNumber,
          sentAt,
        }),
        portalAccountId,
        audience: 'PORTAL',
      });
    }

    await writeAudit({
      userId: auth.userId,
      action: 'CONTENT_SEND_FOR_CUSTOMER_APPROVAL',
      entityType: 'ContentVersion',
      entityId: versionId,
      after: { versionNumber: version.versionNumber, status: 'PENDING_CUSTOMER_APPROVAL' },
      req,
    });

    await logActivity(projectId, {
      userId: auth.userId,
      action: 'CONTENT_SENT_FOR_APPROVAL',
      entityType: 'ContentVersion',
      entityId: versionId,
      message: `ارسال نسخه ${version.versionNumber} برای تأیید مشتری`,
      meta: { versionNumber: version.versionNumber },
    });

    return this.getVersion(projectId, versionId);
  },

  /**
   * Toggle manager confirmation for one content section (سناریو / نریشن / استوری‌بورد).
   */
  async confirmSection(projectId, versionId, { section, confirmed } = {}, auth, req) {
    if (!CONTENT_SECTIONS.includes(section)) {
      throw new AppError('بخش نامعتبر است', 400, 'VALIDATION');
    }
    if (typeof confirmed !== 'boolean') {
      throw new AppError('وضعیت تأیید الزامی است', 400, 'VALIDATION');
    }

    const version = await prisma.contentVersion.findFirst({
      where: { id: versionId, projectId },
    });
    if (!version) throw new AppError('نسخه یافت نشد', 404, 'NOT_FOUND');
    if (!canToggleSectionConfirm(version)) {
      throw new AppError(
        'این نسخه قفل یا تأیید شده است و قابل تغییر تأیید بخش نیست',
        400,
        'VERSION_LOCKED',
      );
    }
    if (!versionHasSection(version, section)) {
      throw new AppError('این بخش در نسخه موجود نیست', 400, 'SECTION_EMPTY');
    }

    const extras =
      version.extras && typeof version.extras === 'object' && !Array.isArray(version.extras)
        ? { ...version.extras }
        : {};
    const prevConfirm =
      extras.managerSectionConfirm &&
      typeof extras.managerSectionConfirm === 'object' &&
      !Array.isArray(extras.managerSectionConfirm)
        ? { ...extras.managerSectionConfirm }
        : {};
    const prevSection =
      prevConfirm[section] &&
      typeof prevConfirm[section] === 'object' &&
      !Array.isArray(prevConfirm[section])
        ? { ...prevConfirm[section] }
        : {};

    const at = new Date().toISOString();
    prevConfirm[section] = confirmed
      ? { confirmed: true, at, byUserId: auth.userId || null }
      : { confirmed: false, at, byUserId: auth.userId || null, ...(prevSection.at ? { previouslyAt: prevSection.at } : {}) };

    extras.managerSectionConfirm = prevConfirm;

    const updated = await prisma.contentVersion.update({
      where: { id: versionId },
      data: { extras },
    });

    await writeAudit({
      userId: auth.userId,
      action: confirmed ? 'CONTENT_SECTION_CONFIRMED' : 'CONTENT_SECTION_UNCONFIRMED',
      entityType: 'ContentVersion',
      entityId: versionId,
      after: { section, confirmed, versionNumber: version.versionNumber },
      req,
    });

    return withManagerSectionConfirm(updated);
  },

  /**
   * Manager internal approve: lock version and unlock narrator/editor assign flows
   * without waiting for customer approval or sending portal notifications.
   */
  async releaseForProduction(projectId, versionId, auth, req) {
    const version = await prisma.contentVersion.findFirst({
      where: { id: versionId, projectId },
    });
    if (!version) throw new AppError('نسخه یافت نشد', 404, 'NOT_FOUND');

    // Idempotent: already released / approved+locked.
    if (version.status === 'APPROVED' && version.isLocked) {
      const confirm = getManagerSectionConfirm(version);
      if (confirm.releasedAt) {
        return this.getVersion(projectId, versionId);
      }
      // Approved via another path (customer / manual) — treat as done.
      return this.getVersion(projectId, versionId);
    }

    if (!canToggleSectionConfirm(version)) {
      throw new AppError(
        'این نسخه برای تأیید داخلی در دسترس نیست',
        400,
        'VERSION_LOCKED',
      );
    }

    const present = CONTENT_SECTIONS.filter((section) =>
      versionHasSection(version, section),
    );
    if (!present.length) {
      throw new AppError('محتوای قابل تأیید وجود ندارد', 400, 'EMPTY_CONTENT');
    }

    const releasedAt = new Date();
    const extras =
      version.extras && typeof version.extras === 'object' && !Array.isArray(version.extras)
        ? { ...version.extras }
        : {};
    const prevConfirm =
      extras.managerSectionConfirm &&
      typeof extras.managerSectionConfirm === 'object' &&
      !Array.isArray(extras.managerSectionConfirm)
        ? { ...extras.managerSectionConfirm }
        : {};

    // One-click release confirms every present section, then unlocks production.
    const at = releasedAt.toISOString();
    for (const section of present) {
      prevConfirm[section] = {
        confirmed: true,
        at,
        byUserId: auth.userId || null,
      };
    }
    extras.managerSectionConfirm = {
      ...prevConfirm,
      releasedAt: at,
      releasedById: auth.userId || null,
    };

    await prisma.$transaction(async (tx) => {
      // Supersede other customer-pending versions — this becomes production source of truth.
      await tx.contentVersion.updateMany({
        where: {
          projectId,
          kind: version.kind,
          id: { not: versionId },
          status: 'PENDING_CUSTOMER_APPROVAL',
          publishedToClient: true,
        },
        data: { publishedToClient: false, status: 'SUPERSEDED' },
      });

      await tx.contentVersion.update({
        where: { id: versionId },
        data: {
          status: 'APPROVED',
          isLocked: true,
          publishedToClient: true,
          publishedAt: releasedAt,
          approvedById: auth.userId,
          rejectionReason: null,
          rejectedById: null,
          extras,
        },
      });

      await tx.approval.create({
        data: {
          projectId,
          contentVersionId: versionId,
          type: 'MANAGER_CONTENT',
          decision: 'APPROVED',
          comment: 'تأیید داخلی مدیر — آماده‌سازی نریشن/ادیت',
          actorType: 'MANAGER',
          actorId: auth.userId,
        },
      });

      await tx.project.update({
        where: { id: projectId },
        data: {
          status: 'NARRATION_RECORDING',
          customerFacingStatus: 'IN_PRODUCTION',
        },
      });

      await narrationService.ensureTaskForProject(projectId, {
        tx,
        contentVersionId: versionId,
        assignedById: auth.userId,
      });

      await tx.projectTimelineEvent.create({
        data: {
          projectId,
          type: 'CONTENT_MANAGER_RELEASED',
          title: 'تأیید داخلی محتوا توسط مدیر',
          body: `نسخه ${version.versionNumber} تأیید شد و برای نریشن/ادیت آماده است`,
          actorId: auth.userId,
        },
      });

      await rebuildProjectContext(projectId, tx);
    });

    await writeAudit({
      userId: auth.userId,
      action: 'CONTENT_MANAGER_RELEASED',
      entityType: 'ContentVersion',
      entityId: versionId,
      after: {
        versionNumber: version.versionNumber,
        status: 'APPROVED',
        releasedForProduction: true,
      },
      req,
    });

    await logActivity(projectId, {
      userId: auth.userId,
      action: 'CONTENT_MANAGER_RELEASED',
      entityType: 'ContentVersion',
      entityId: versionId,
      message: `تأیید داخلی نسخه ${version.versionNumber} — آماده نریشن و ادیت`,
      meta: { versionNumber: version.versionNumber },
    });

    return this.getVersion(projectId, versionId);
  },

};
