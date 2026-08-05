import { AppError } from '../utils/response.js';
import { normalizeDigitsDeep } from '../utils/toEnglishDigits.js';

export function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      // Defense-in-depth: also covers multipart bodies filled after Multer
      if (req[source] && typeof req[source] === 'object') {
        normalizeDigitsDeep(req[source]);
      } else if (typeof req[source] === 'string') {
        req[source] = normalizeDigitsDeep(req[source]);
      }
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function assert(condition, message, status = 400, code = 'ASSERTION') {
  if (!condition) throw new AppError(message, status, code);
}
