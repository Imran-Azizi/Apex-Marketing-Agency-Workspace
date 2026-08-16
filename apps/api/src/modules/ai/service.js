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
import { rebuildProjectContext } from '../../services/projectContext.js';
import { writeAudit } from '../../middleware/audit.js';
import { env, getActiveAiConfig } from '../../config/env.js';
import {
  createNotificationOnce,
  buildContentSentForApprovalNotification,
} from '../../services/notifications.js';
import {
  canManagerDeleteVersion,
  canManagerEditVersion,
  canManagerSendToCustomer,
} from '../../services/contentVersionRules.js';

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
    description: 'One production-ready voice-over script with auto-selected tone',
    descriptionFa: 'یک متن گویندگی نهایی آماده تولید با انتخاب خودکار لحن',
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
      context: true,
      crmCustomer: true,
      service: true,
      format: true,
      files: { where: { deletedAt: null } },
      assetRefs: { include: { clientAsset: true } },
      contentVersions: {
        orderBy: { versionNumber: 'desc' },
        take: 5,
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
      feedback: { orderBy: { createdAt: 'desc' }, take: 10 },
      approvals: { orderBy: { createdAt: 'desc' }, take: 10 },
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
        personName: project.crmCustomer.personName,
        companyName: project.crmCustomer.companyName,
        city: project.crmCustomer.city,
      },
      assets: [
        ...project.files.map((f) => ({
          source: 'project_file',
          id: f.id,
          kind: f.kind,
          name: f.name,
          storageKey: f.storageKey,
        })),
        ...project.assetRefs.map((r) => ({
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
    const { input } = await loadProjectInput(projectId);
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
      markStep(steps, 'finalize', {
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
        });
        storyboardImagesMeta = storyboardOutput.imagesMeta || null;
        delete storyboardOutput.imagesMeta;
      } catch (imgErr) {
        console.warn('[AI storyboard images]', imgErr.message);
      }
    }

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
  async ensureAgentsSeeded() {
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
  },

  async getOverview(projectId) {
    await this.ensureAgentsSeeded();
    const [lastWorkflow, versions, running, feedback, approvals] = await Promise.all([
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

    return {
      lastExecution: lastWorkflow,
      currentWorkflow: running,
      processingStatus: running?.status || lastWorkflow?.status || 'IDLE',
      generatedContentCount: versions,
      pipelineSteps: PIPELINE_STEPS,
      customerFeedback: feedback,
      approvalTimeline: approvals,
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
    return prisma.contentVersion.findMany({
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
  },

  async getVersion(projectId, versionId) {
    const version = await prisma.contentVersion.findFirst({
      where: { id: versionId, projectId },
      include: { approvals: { orderBy: { createdAt: 'desc' } } },
    });
    if (!version) throw new AppError('نسخه یافت نشد', 404, 'NOT_FOUND');
    return version;
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
        console.error('[AI pipeline]', workflow.id, err.message);
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

  async updateVersionContent(projectId, versionId, { scenario, narration, storyboard, extras, changeNotes, editPrompt }, auth, req) {
    const version = await prisma.contentVersion.findFirst({
      where: { id: versionId, projectId },
    });
    if (!version) throw new AppError('نسخه یافت نشد', 404, 'NOT_FOUND');
    if (!canManagerEditVersion(version)) {
      throw new AppError('نسخه در انتظار تأیید مشتری یا تأییدشده قابل ویرایش مستقیم نیست؛ بازتولید یا نسخه جدید بسازید', 400, 'LOCKED');
    }

    const nextScenario =
      scenario !== undefined
        ? normalizeScenarioOutput(scenario, projectId)
        : version.scenario;
    const nextNarration =
      narration !== undefined
        ? normalizeNarrationOutput(narration, projectId)
        : version.narration;
    const nextStoryboard =
      storyboard !== undefined
        ? normalizeStoryboardOutput(storyboard, projectId)
        : version.storyboard;

    const normalizedEditPrompt = normalizeUserPrompt(editPrompt);
    const nextChangeNotes =
      changeNotes ||
      (normalizedEditPrompt ? `ویرایش با دستور: ${normalizedEditPrompt.slice(0, 180)}` : null) ||
      version.changeNotes;

    const prevExtras =
      version.extras && typeof version.extras === 'object' && !Array.isArray(version.extras)
        ? version.extras
        : {};
    const nextExtras =
      extras !== undefined
        ? extras
        : normalizedEditPrompt
          ? { ...prevExtras, lastEditPrompt: normalizedEditPrompt }
          : version.extras;

    const updated = await prisma.contentVersion.update({
      where: { id: versionId },
      data: {
        scenario: nextScenario,
        narration: nextNarration,
        storyboard: nextStoryboard,
        extras: nextExtras,
        status: 'UNDER_REVIEW',
        changeNotes: nextChangeNotes,
      },
    });

    await writeAudit({
      userId: auth.userId,
      action: 'AI_CONTENT_EDIT',
      entityType: 'ContentVersion',
      entityId: versionId,
      req,
    });

    await logActivity(projectId, {
      userId: auth.userId,
      action: 'AI_CONTENT_EDIT',
      entityType: 'ContentVersion',
      entityId: versionId,
      message: normalizedEditPrompt ? 'ویرایش محتوا با دستورات مدیر' : 'ویرایش دستی مدیر',
      meta: { editPrompt: normalizedEditPrompt },
    });

    return updated;
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
        throw new AppError('این نسخه قبلاً توسط مشتری تأیید شده است', 400, 'ALREADY_APPROVED');
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

};
