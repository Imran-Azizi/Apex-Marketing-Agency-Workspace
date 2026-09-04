/**
 * Optional OpenRouter enrichment for sales recommendations.
 * Uses the shared AI fallback (free OpenRouter pool when enabled).
 */

import { completeWithModelFallback } from '../../services/ai/ai.service.js';
import { getModelConfig } from '../../services/ai/models.config.js';
import { extractJson } from '../../services/ai/validate.js';
import { SALES_ASSISTANT_PROMPT } from '../../services/ai/prompts/sales-assistant.prompt.js';
import { composeRecommendation } from './compose.js';
import { compactContextForAi } from './context.js';
import { PROMPT_VERSION } from './constants.js';

const AGENT = 'SALES_ASSISTANT';

function normalizeAiOutput(parsed, fallback) {
  if (!parsed || typeof parsed !== 'object' || parsed.raw) return fallback;
  const pick = (key) => {
    const v = parsed[key];
    return typeof v === 'string' && v.trim() ? v.trim() : fallback[key];
  };
  return {
    title: pick('title'),
    reason: pick('reason'),
    whatHappened: pick('whatHappened'),
    customerWants: pick('customerWants'),
    whatsStopping: pick('whatsStopping'),
    recommendedAction: pick('recommendedAction'),
    suggestedMessage: pick('suggestedMessage'),
    salesApproach: pick('salesApproach'),
    closeHelp: pick('closeHelp'),
  };
}

export async function enrichRecommendation(signal, context) {
  const fallback = composeRecommendation(signal, context);
  const cfg = getModelConfig();

  if (cfg.provider === 'mock') {
    return { usedAi: false, model: 'mock', promptVersion: PROMPT_VERSION, output: fallback };
  }

  const userContent = JSON.stringify({
    kind: signal.kind,
    trigger: signal.trigger,
    intentLevel: signal.intentLevel,
    objections: signal.objections,
    facts: signal.facts,
    context: compactContextForAi(context),
    instruction: 'Generate a sales-coaching recommendation JSON. Persian text. Do not invent commercial terms.',
  });

  try {
    const completion = await completeWithModelFallback({
      agentType: AGENT,
      system: SALES_ASSISTANT_PROMPT.system,
      userContent,
    });
    const parsed = extractJson(completion.text);
    const output = normalizeAiOutput(parsed, fallback);
    return {
      usedAi: true,
      model: completion.model,
      promptVersion: PROMPT_VERSION,
      output,
    };
  } catch (err) {
    console.error('[sales-assistant] AI enrich failed:', err?.message || err);
    return { usedAi: false, model: null, promptVersion: PROMPT_VERSION, output: fallback };
  }
}

export function mockSalesCopy(signal, context) {
  return composeRecommendation(signal, context);
}
