import { normalizeDigitsDeep } from '../utils/toEnglishDigits.js';

/**
 * Normalize Persian / Arabic-Indic digits to English digits on all
 * incoming request string values (body, query, params).
 *
 * Mount after express.json / urlencoded so parsed payloads are available.
 */
export function normalizeDigitsMiddleware(req, _res, next) {
  try {
    if (req.body && typeof req.body === 'object') {
      normalizeDigitsDeep(req.body);
    }
    if (req.query && typeof req.query === 'object') {
      normalizeDigitsDeep(req.query);
    }
    if (req.params && typeof req.params === 'object') {
      normalizeDigitsDeep(req.params);
    }
    next();
  } catch (err) {
    next(err);
  }
}
