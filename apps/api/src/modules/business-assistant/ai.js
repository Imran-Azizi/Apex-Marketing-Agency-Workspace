import { completeWithModelFallback } from '../../services/ai/ai.service.js';
import { getModelConfig } from '../../services/ai/models.config.js';
import { extractJson } from '../../services/ai/validate.js';
import {
  BUSINESS_ASSISTANT_PROMPT,
  BUSINESS_ASSISTANT_CHAT_PROMPT,
} from '../../services/ai/prompts/business-assistant.prompt.js';
import { compactSnapshotForAi } from './context.js';

const AGENT = 'BUSINESS_ASSISTANT';

function asStringArray(value, fallback = []) {
  if (!Array.isArray(value)) return fallback;
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        return String(item.text || item.title || item.action || item.what || '').trim();
      }
      return '';
    })
    .filter(Boolean);
}

function asActions(value, fallback = []) {
  if (!Array.isArray(value) || !value.length) return fallback;
  return value
    .map((item) => {
      if (typeof item === 'string') {
        return {
          title: item,
          what: item,
          why: '',
          problemOrOpportunity: '',
          impact: '',
          priority: 'MEDIUM',
          timeframe: 'این هفته',
        };
      }
      if (!item || typeof item !== 'object') return null;
      const what = String(item.what || item.action || item.title || '').trim();
      if (!what) return null;
      return {
        title: String(item.title || what),
        what,
        why: String(item.why || ''),
        problemOrOpportunity: String(item.problemOrOpportunity || item.problem || ''),
        impact: String(item.impact || ''),
        priority: ['HIGH', 'MEDIUM', 'LOW'].includes(item.priority) ? item.priority : 'MEDIUM',
        timeframe: String(item.timeframe || 'این هفته'),
      };
    })
    .filter(Boolean);
}

function mergeBriefing(parsed, fallback) {
  if (!parsed || typeof parsed !== 'object' || parsed.raw) return fallback;
  const weekly = parsed.weeklyStrategy || {};
  const monthly = parsed.monthlyStrategy || {};
  return {
    ...fallback,
    overview: typeof parsed.overview === 'string' && parsed.overview.trim()
      ? parsed.overview.trim()
      : fallback.overview,
    goingWell: asStringArray(parsed.goingWell, fallback.goingWell),
    needsAttention: asStringArray(parsed.needsAttention, fallback.needsAttention),
    strengths: asStringArray(parsed.strengths, fallback.strengths),
    weaknesses: asStringArray(parsed.weaknesses, fallback.weaknesses),
    opportunities: asStringArray(parsed.opportunities, fallback.opportunities),
    weeklyStrategy: {
      ...fallback.weeklyStrategy,
      summary: weekly.summary || fallback.weeklyStrategy.summary,
      problems: asStringArray(weekly.problems, fallback.weeklyStrategy.problems),
      opportunities: asStringArray(weekly.opportunities, fallback.weeklyStrategy.opportunities),
      priorities: asStringArray(weekly.priorities, fallback.weeklyStrategy.priorities),
      marketing: asStringArray(weekly.marketing, fallback.weeklyStrategy.marketing),
      sales: asStringArray(weekly.sales, fallback.weeklyStrategy.sales),
      customers: asStringArray(weekly.customers, fallback.weeklyStrategy.customers),
      operations: asStringArray(weekly.operations, fallback.weeklyStrategy.operations),
      employees: asStringArray(weekly.employees, fallback.weeklyStrategy.employees),
      tasks: asActions(weekly.tasks, fallback.weeklyStrategy.tasks),
    },
    monthlyStrategy: {
      ...fallback.monthlyStrategy,
      overview: monthly.overview || fallback.monthlyStrategy.overview,
      strengths: asStringArray(monthly.strengths, fallback.monthlyStrategy.strengths),
      weaknesses: asStringArray(monthly.weaknesses, fallback.monthlyStrategy.weaknesses),
      growthOpportunities: asStringArray(
        monthly.growthOpportunities,
        fallback.monthlyStrategy.growthOpportunities,
      ),
      marketingStrategy: monthly.marketingStrategy || fallback.monthlyStrategy.marketingStrategy,
      salesStrategy: monthly.salesStrategy || fallback.monthlyStrategy.salesStrategy,
      customerGrowthStrategy:
        monthly.customerGrowthStrategy || fallback.monthlyStrategy.customerGrowthStrategy,
      revenueOpportunities: asStringArray(
        monthly.revenueOpportunities,
        fallback.monthlyStrategy.revenueOpportunities,
      ),
      operationalImprovements: asStringArray(
        monthly.operationalImprovements,
        fallback.monthlyStrategy.operationalImprovements,
      ),
      goals: asStringArray(monthly.goals, fallback.monthlyStrategy.goals),
      actions: asActions(monthly.actions, fallback.monthlyStrategy.actions),
      kpis: Array.isArray(monthly.kpis) && monthly.kpis.length
        ? monthly.kpis
        : fallback.monthlyStrategy.kpis,
    },
    recommendedActions: asActions(parsed.recommendedActions, fallback.recommendedActions),
    dataNotes:
      typeof parsed.dataNotes === 'string' && parsed.dataNotes.trim()
        ? parsed.dataNotes.trim()
        : fallback.insufficientData
          ? 'داده کافی برای برخی توصیه‌ها موجود نیست؛ ارقام موجود از سیستم آمده‌اند و موارد خالی حدس زده نشده‌اند.'
          : null,
  };
}

export async function generateBusinessBriefing({ snapshot, signals, fallback }) {
  const cfg = getModelConfig();
  if (cfg.provider === 'mock') {
    return { usedAi: false, model: 'mock', output: fallback };
  }

  const userContent = JSON.stringify({
    role: 'business_consultant_briefing',
    snapshot: compactSnapshotForAi(snapshot),
    signals: (signals || []).slice(0, 24).map((s) => ({
      kind: s.kind,
      category: s.category,
      strengthOrWeakness: s.strengthOrWeakness,
      priority: s.priority,
      facts: s.facts,
    })),
    fallbackOutline: {
      insufficientData: fallback.insufficientData,
      kpis: fallback.kpis,
    },
    instruction:
      'Generate a professional Persian briefing JSON for the manager. Use ONLY provided numbers. If data is insufficient, say so in dataNotes and do not invent KPIs.',
  });

  try {
    const completion = await completeWithModelFallback({
      agentType: AGENT,
      system: BUSINESS_ASSISTANT_PROMPT.system,
      userContent,
    });
    const parsed = extractJson(completion.text);
    return {
      usedAi: true,
      model: completion.model,
      output: mergeBriefing(parsed, fallback),
    };
  } catch (err) {
    console.error('[business-assistant] briefing AI failed:', err?.message || err);
    return { usedAi: false, model: null, output: fallback };
  }
}

export async function chatReply({ snapshot, history, message, monthlyTarget }) {
  const cfg = getModelConfig();
  if (cfg.provider === 'mock') {
    return {
      usedAi: false,
      model: 'mock',
      content:
        'داده‌های کسب‌وکار در دسترس است. لطفاً OPENROUTER_API_KEY را تنظیم کنید تا پاسخ هوشمند دریافت کنید.',
    };
  }

  const userContent = JSON.stringify({
    snapshot: compactSnapshotForAi(snapshot),
    monthlyTarget,
    targetProgress: snapshot?.targetProgress,
    history: (history || []).slice(-12).map((m) => ({
      role: m.role,
      content: m.content,
    })),
    message,
  });

  try {
    const completion = await completeWithModelFallback({
      agentType: AGENT,
      system: BUSINESS_ASSISTANT_CHAT_PROMPT.system,
      userContent,
    });
    const text = String(completion.text || '').trim();
    return {
      usedAi: true,
      model: completion.model,
      content: text || 'پاسخی تولید نشد. لطفاً سوال را دوباره بپرسید.',
    };
  } catch (err) {
    console.error('[business-assistant] chat failed:', err?.message || err);
    return {
      usedAi: false,
      model: null,
      content: 'خطا در ارتباط با هوش مصنوعی. لطفاً بعداً تلاش کنید.',
    };
  }
}
