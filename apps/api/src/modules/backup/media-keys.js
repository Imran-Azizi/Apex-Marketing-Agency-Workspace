import { collectMediaKeys as collectLandingMediaKeys } from '../landing-pages/content.js';
import { resolveStorageKey, collectStorageKeys } from '../../services/storage/object-delete.js';
import { MEDIA_KEY_FIELDS } from './tables.js';

/**
 * Walk arbitrary JSON and collect string values that look like storage keys.
 * Conservative: only paths under known media roots or already-resolved keys.
 */
const MEDIA_PATH_HINT =
  /^(images|videos|documents|audio|projects|users|portfolio|landing|chat|hero|showcase|company|apex)\b/i;

function walkJsonForKeys(value, out) {
  if (value == null) return;
  if (typeof value === 'string') {
    const key = resolveStorageKey(value);
    if (key && (MEDIA_PATH_HINT.test(key) || key.includes('/'))) {
      out.add(key);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walkJsonForKeys(item, out);
    return;
  }
  if (typeof value === 'object') {
    for (const v of Object.values(value)) walkJsonForKeys(v, out);
  }
}

/**
 * Collect every application storage key referenced by backed-up table rows.
 * @param {Record<string, object[]>} tables
 * @returns {string[]}
 */
export function collectMediaKeysFromTables(tables) {
  const keys = new Set();

  for (const [modelName, rows] of Object.entries(tables || {})) {
    if (!Array.isArray(rows)) continue;
    const fields = MEDIA_KEY_FIELDS[modelName] || [];

    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;

      for (const field of fields) {
        for (const key of collectStorageKeys(row[field])) {
          keys.add(key);
        }
      }

      // Landing page draft + published snapshots embed media keys in JSON
      if (modelName === 'LandingPage') {
        for (const content of [row.draftContent, row.publishedContent]) {
          if (!content) continue;
          try {
            for (const key of collectLandingMediaKeys(content)) {
              const resolved = resolveStorageKey(key);
              if (resolved) keys.add(resolved);
            }
          } catch {
            walkJsonForKeys(content, keys);
          }
        }
      }

      // Catch keys stored in meta / JSON blobs on media-adjacent models
      if (row.meta && typeof row.meta === 'object') {
        walkJsonForKeys(row.meta, keys);
      }
    }
  }

  return [...keys].sort();
}
