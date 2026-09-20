/**
 * Project-related photoreal stills when paid image APIs are unavailable.
 * Uses Openverse (Creative Commons) search grounded in scene prompts.
 */

import { isSafeExternalUrl } from '../../utils/ssrf.js';

const STOP = new Set([
  'the',
  'and',
  'with',
  'from',
  'this',
  'that',
  'into',
  'over',
  'under',
  'for',
  'a',
  'an',
  'of',
  'to',
  'in',
  'on',
  'at',
  'by',
  'as',
  'is',
  'are',
  'be',
  'no',
  'not',
  'or',
  'premium',
  'commercial',
  'cinematography',
  'still',
  'widescreen',
  'sharp',
  'focus',
  'well',
  'lit',
  'cinematic',
  'color',
  'grade',
  'photoreal',
  'professional',
  'lighting',
  'unique',
  'scene',
  'illustration',
  'anime',
  'fashion',
  'portrait',
  'watermark',
  'unreadable',
  'text',
  'frame',
  'shot',
  'camera',
  'lens',
  '16:9',
  'image',
  'photo',
  'picture',
]);

/**
 * Build a concise English Openverse query from the scene image prompt + metadata.
 */
export function buildSceneStockSearchQuery(prompt, scene = {}) {
  const extras = [
    scene.visualDescription,
    scene.visual,
    scene.description,
    scene.action,
    scene.title,
  ]
    .filter(Boolean)
    .map((v) => String(v))
    .join(' ');

  const raw = `${String(prompt || '')} ${extras}`
    .replace(/Premium commercial[\s\S]*$/i, ' ')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/[^a-zA-Z0-9\s\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = raw
    .split(' ')
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP.has(w.toLowerCase()));

  const unique = [];
  for (const w of words) {
    const key = w.toLowerCase();
    if (unique.some((u) => u.toLowerCase() === key)) continue;
    unique.push(w);
    if (unique.length >= 8) break;
  }

  const query = unique.join(' ').trim();
  return query || 'cinematic commercial product photography interior';
}

async function searchOpenverse(query, { pageSize = 8 } = {}) {
  const params = new URLSearchParams({
    q: String(query || '').slice(0, 180),
    page_size: String(pageSize),
    license: 'cc0,pdm,by,by-sa',
    mature: 'false',
  });
  const url = `https://api.openverse.org/v1/images/?${params}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'APEX-Storyboard/1.0 (storyboard reference stills)',
      },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const rows = Array.isArray(data.results) ? data.results : [];
    // Prefer landscape / wider frames for 16:9 storyboard panels.
    return rows
      .filter((row) => row?.url && Number(row.width || 0) >= 640)
      .sort((a, b) => {
        const arA = Number(a.width || 1) / Math.max(1, Number(a.height || 1));
        const arB = Number(b.width || 1) / Math.max(1, Number(b.height || 1));
        const score = (ar) => Math.abs(ar - 16 / 9);
        return score(arA) - score(arB);
      });
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function downloadImageBuffer(url) {
  if (!url || !isSafeExternalUrl(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        Accept: 'image/jpeg,image/png,image/webp,image/*',
        'User-Agent': 'APEX-Storyboard/1.0 (storyboard reference stills)',
      },
      signal: controller.signal,
    });
    const ct = res.headers.get('content-type') || '';
    if (!res.ok) return null;
    if (ct && !ct.startsWith('image/') && !ct.includes('octet-stream')) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 8_000) return null;
    const magic = buffer.slice(0, 3).toString('hex');
    if (magic !== 'ffd8ff' && magic !== '89504e' && !ct.startsWith('image/')) {
      return null;
    }
    return buffer;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch one project-related photoreal still for a scene prompt.
 * @returns {Promise<{ b64: string|null, url: string|null, error?: string, meta?: object }>}
 */
export async function fetchRelatedStockStill(prompt, { scene = {}, seed = 0 } = {}) {
  const query = buildSceneStockSearchQuery(prompt, scene);
  const candidates = await searchOpenverse(query);
  if (!candidates.length) {
    // Broader fallback from first 3 keywords
    const short = query.split(' ').slice(0, 3).join(' ');
    const retry = short && short !== query ? await searchOpenverse(short) : [];
    if (!retry.length) {
      return { b64: null, url: null, error: `No related stock for: ${query}` };
    }
    candidates.push(...retry);
  }

  const start = Math.abs(Number(seed) || 0) % candidates.length;
  const ordered = [
    ...candidates.slice(start),
    ...candidates.slice(0, start),
  ];

  for (const row of ordered.slice(0, 4)) {
    const buffer = await downloadImageBuffer(row.url);
    if (!buffer) continue;
    return {
      b64: buffer.toString('base64'),
      url: null,
      meta: {
        provider: 'openverse',
        query,
        sourceUrl: row.url,
        title: row.title || null,
        license: row.license || null,
        creator: row.creator || null,
      },
    };
  }

  return { b64: null, url: null, error: `Failed to download related stock for: ${query}` };
}
