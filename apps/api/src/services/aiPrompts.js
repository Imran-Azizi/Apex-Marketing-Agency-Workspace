/**
 * Backward-compatible re-export.
 * Prefer importing from `services/ai/prompts` or `services/ai/index.js`.
 */

export {
  AGENT_PROMPTS,
  getAgentPrompt,
  PROMPT_VERSION,
  normalizeScenarioOutput,
  normalizeNarrationOutput,
  normalizeStoryboardOutput,
  normalizePipelineOutputs,
} from './ai/index.js';
