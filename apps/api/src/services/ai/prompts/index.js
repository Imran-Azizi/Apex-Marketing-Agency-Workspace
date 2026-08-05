import { SCENARIO_PROMPT } from './scenario.prompt.js';
import { NARRATION_PROMPT } from './narration.prompt.js';
import { STORYBOARD_PROMPT } from './storyboard.prompt.js';
import { PROMPT_VERSION } from '../models.config.js';

export const AGENT_PROMPTS = {
  SCENARIO: SCENARIO_PROMPT,
  NARRATION: NARRATION_PROMPT,
  STORYBOARD: STORYBOARD_PROMPT,
};

export function getAgentPrompt(agentType) {
  return (
    AGENT_PROMPTS[agentType] || {
      modelTier: 'reasoning',
      system: `You are agent ${agentType}. Return concise JSON including projectId.`,
    }
  );
}

export { PROMPT_VERSION };
export { SCENARIO_PROMPT, NARRATION_PROMPT, STORYBOARD_PROMPT };
