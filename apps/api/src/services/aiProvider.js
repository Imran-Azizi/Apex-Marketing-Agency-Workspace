/**
 * Backward-compatible re-export.
 * Prefer importing from `services/ai/index.js`.
 */

export {
  aiProvider,
  formatAiError,
  generatePipeline,
  runAgent,
  sanitizeAiInput,
  contentAiService,
} from './ai/index.js';

export { formatAiError as formatOpenAiError } from './ai/errors.js';
