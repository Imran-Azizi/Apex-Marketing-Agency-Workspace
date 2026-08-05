/**
 * Public AI services barrel.
 */

export {
  aiProvider,
  contentAiService,
  runAgent,
  generatePipeline,
  sanitizeAiInput,
  formatAiError,
} from './ai.service.js';

export {
  PROMPT_VERSION,
  CONTENT_AGENTS,
  getModelConfig,
  resolveModelsForAgent,
  resolveGenerationParams,
} from './models.config.js';

export {
  AGENT_PROMPTS,
  getAgentPrompt,
  SCENARIO_PROMPT,
  NARRATION_PROMPT,
  STORYBOARD_PROMPT,
} from './prompts/index.js';

export {
  normalizeScenarioOutput,
  normalizeNarrationOutput,
  normalizeStoryboardOutput,
  normalizePipelineOutputs,
  validateAgentOutput,
  extractJson,
} from './validate.js';

export { getLlmProvider, getActiveProviderInfo, listProviders } from './provider.factory.js';
export { openRouterService } from './openrouter.service.js';
