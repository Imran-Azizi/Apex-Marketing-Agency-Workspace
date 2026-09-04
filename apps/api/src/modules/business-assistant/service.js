import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/response.js';
import { loadBusinessSnapshot } from './context.js';
import { evaluateBusinessSignals } from './rules.js';
import { composeBriefing } from './briefing.js';
import { generateBusinessBriefing, chatReply } from './ai.js';
import { getSettings } from './settings.js';

const chatSchema = z.object({
  message: z.string().trim().min(1).max(8000),
});

function canManage(auth) {
  const perms = new Set(auth?.permissions || []);
  return perms.has('business_assistant.manage') || perms.has('settings.edit');
}

function canAct(auth) {
  const perms = new Set(auth?.permissions || []);
  return perms.has('business_assistant.act') || canManage(auth);
}

async function getCurrentTarget() {
  const now = new Date();
  return prisma.businessAssistantMonthlyTarget.findUnique({
    where: { year_month: { year: now.getFullYear(), month: now.getMonth() + 1 } },
    include: { createdBy: { select: { id: true, fullName: true } } },
  });
}

export const businessAssistantService = {
  async getBriefing(auth) {
    const settings = await getSettings();
    const snapshot = await loadBusinessSnapshot(auth, { settings });
    const signals = evaluateBusinessSignals(snapshot, settings);
    const fallback = composeBriefing(snapshot, signals);
    const ai = await generateBusinessBriefing({ snapshot, signals, fallback });
    return {
      generatedAt: snapshot.generatedAt,
      usedAi: ai.usedAi,
      model: ai.model,
      insufficientData: fallback.insufficientData,
      kpis: fallback.kpis,
      pipeline: fallback.pipeline,
      briefing: ai.output,
    };
  },

  async getChatMessages(auth) {
    return prisma.businessAssistantChatMessage.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  },

  async sendChatMessage(body, auth) {
    if (!canAct(auth)) throw new AppError('دسترسی ندارید', 403, 'FORBIDDEN');
    const snapshot = await loadBusinessSnapshot(auth, { settings: await getSettings() });
    const monthlyTarget = await getCurrentTarget();
    const history = await prisma.businessAssistantChatMessage.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    await prisma.businessAssistantChatMessage.create({
      data: {
        userId: auth.userId,
        role: 'USER',
        content: body.message,
      },
    });

    const reply = await chatReply({
      snapshot,
      history: history.reverse(),
      message: body.message,
      monthlyTarget,
    });

    const assistantMsg = await prisma.businessAssistantChatMessage.create({
      data: {
        userId: auth.userId,
        role: 'ASSISTANT',
        content: reply.content,
        contextSnapshot: snapshot.facts,
        usedAi: reply.usedAi,
        aiModel: reply.model,
      },
    });

    return { userMessage: body.message, assistant: assistantMsg };
  },

  async clearChat(auth) {
    if (!canManage(auth)) throw new AppError('دسترسی ندارید', 403, 'FORBIDDEN');
    await prisma.businessAssistantChatMessage.deleteMany({
      where: { userId: auth.userId },
    });
    return { cleared: true };
  },
};

export { chatSchema };
