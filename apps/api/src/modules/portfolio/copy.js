/**
 * Public-safe portfolio copy helpers: AI input, parsing, and mock fallback.
 * Keeps PII and internal ops data out of generated marketing text.
 */

import { extractJson } from '../../services/ai/validate.js';

export const PORTFOLIO_TITLE_MAX = 120;
export const PORTFOLIO_DESCRIPTION_MAX = 2000;
export const PORTFOLIO_SUCCESS_STORY_MAX = 4000;
export const PORTFOLIO_SUCCESS_STORY_MIN = 80;

const BRIEF_SAFE_KEYS = [
  'goal',
  'audience',
  'message',
  'mainMessage',
  'styleNotes',
  'tone',
  'platforms',
  'language',
  'industry',
  'product',
  'productName',
  'productDescription',
  'theme',
  'cta',
  'features',
  'allowedClaims',
  'companyName',
  'brandLimits',
  'mandatoryTexts',
  'outcomes',
  'results',
  'kpis',
];

const PII_BRIEF_KEYS = new Set([
  'email',
  'phone',
  'whatsapp',
  'address',
  'personName',
  'contactName',
  'password',
  'notes',
  'managerNotes',
  'internalNotes',
]);

const TITLE_KEYS = [
  'title',
  'portfolioTitle',
  'headline',
  'name',
  'عنوان',
  'تیتر',
];
const DESCRIPTION_KEYS = [
  'description',
  'shortDescription',
  'summary',
  'blurb',
  'cardDescription',
  'توضیحات',
  'توضیحات کوتاه',
  'خلاصه',
];
const SUCCESS_STORY_KEYS = [
  'successStory',
  'success_story',
  'story',
  'caseStudy',
  'case_study',
  'داستان موفقیت',
  'داستان_موفقیت',
];
const WRAPPER_KEYS = [
  'data',
  'result',
  'output',
  'portfolio',
  'copy',
  'content',
  'payload',
];

function clip(value, max) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

function asRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function pickStr(obj, keys, max = 400) {
  if (!obj) return null;
  for (const key of keys) {
    const clipped = clip(obj[key], max);
    if (clipped) return clipped;
  }
  return null;
}

function pickField(obj, keys, max) {
  if (!obj) return '';
  for (const key of keys) {
    if (!(key in obj)) continue;
    const clipped = clip(obj[key], max);
    if (clipped) return clipped;
  }
  const entries = Object.entries(obj);
  for (const want of keys) {
    const found = entries.find(
      ([k]) => String(k).toLowerCase() === String(want).toLowerCase(),
    );
    if (!found) continue;
    const clipped = clip(found[1], max);
    if (clipped) return clipped;
  }
  return '';
}

function unwrapNestedRecord(rec, depth = 0) {
  if (!rec || depth > 3) return rec;
  const hasDirect =
    pickField(rec, TITLE_KEYS, PORTFOLIO_TITLE_MAX) ||
    pickField(rec, DESCRIPTION_KEYS, PORTFOLIO_DESCRIPTION_MAX) ||
    pickField(rec, SUCCESS_STORY_KEYS, PORTFOLIO_SUCCESS_STORY_MAX);
  if (hasDirect) return rec;
  for (const key of WRAPPER_KEYS) {
    const nested = asRecord(rec[key]);
    if (!nested) continue;
    const unwrapped = unwrapNestedRecord(nested, depth + 1);
    if (
      pickField(unwrapped, TITLE_KEYS, PORTFOLIO_TITLE_MAX) ||
      pickField(unwrapped, DESCRIPTION_KEYS, PORTFOLIO_DESCRIPTION_MAX) ||
      pickField(unwrapped, SUCCESS_STORY_KEYS, PORTFOLIO_SUCCESS_STORY_MAX)
    ) {
      return unwrapped;
    }
  }
  return rec;
}

export function publicSafeBrief(brief) {
  const rec = asRecord(brief);
  if (!rec) return null;
  const safe = {};
  for (const key of BRIEF_SAFE_KEYS) {
    if (PII_BRIEF_KEYS.has(key)) continue;
    const value = rec[key];
    if (value == null || value === '') continue;
    if (Array.isArray(value)) {
      const items = value
        .map((item) => (typeof item === 'string' ? clip(item, 120) : null))
        .filter(Boolean)
        .slice(0, 12);
      if (items.length) safe[key] = items;
      continue;
    }
    if (typeof value === 'object') {
      const nested = clip(JSON.stringify(value), 400);
      if (nested) safe[key] = nested;
      continue;
    }
    const clipped = clip(value, 500);
    if (clipped) safe[key] = clipped;
  }
  return Object.keys(safe).length ? safe : null;
}

export function publicSafeCustomer(customer, brief) {
  const rec = asRecord(customer);
  const briefRec = asRecord(brief);
  const companyName =
    clip(rec?.companyName, 120) || clip(briefRec?.companyName, 120);
  const industry = clip(briefRec?.industry, 80);
  if (!companyName && !industry) return null;
  return {
    ...(companyName ? { companyName } : {}),
    ...(industry ? { industry } : {}),
  };
}

function summarizeScenario(scenario) {
  const rec = asRecord(scenario);
  if (!rec) return null;
  const scenes = Array.isArray(rec.sceneBreakdown)
    ? rec.sceneBreakdown.slice(0, 8).map((scene, index) => ({
        scene: Number(scene?.scene || index + 1),
        description: clip(scene?.description, 180),
      }))
    : undefined;
  const summary = {
    title: pickStr(rec, ['title'], 120),
    concept: pickStr(rec, ['concept'], 400),
    hook: pickStr(rec, ['hook'], 300),
    problem: pickStr(rec, ['problem'], 300),
    solution: pickStr(rec, ['solution'], 300),
    cta: pickStr(rec, ['cta'], 200),
    marketingAngle: pickStr(rec, ['marketingAngle'], 300),
    emotionalDirection: pickStr(rec, ['emotionalDirection'], 200),
    storyFlow: pickStr(rec, ['storyFlow', 'content'], 600),
    ...(scenes?.some((s) => s.description) ? { scenes } : {}),
  };
  return Object.values(summary).some(Boolean) ? summary : null;
}

function summarizeNarration(narration) {
  const rec = asRecord(narration);
  if (!rec) return null;
  const summary = {
    script: pickStr(rec, ['script'], 700),
    tone: pickStr(rec, ['tone'], 80),
    toneExplanation: pickStr(rec, ['toneExplanation'], 240),
  };
  return Object.values(summary).some(Boolean) ? summary : null;
}

function summarizeStoryboard(storyboard) {
  const scenes = Array.isArray(storyboard)
    ? storyboard
    : Array.isArray(asRecord(storyboard)?.scenes)
      ? asRecord(storyboard).scenes
      : Array.isArray(asRecord(storyboard)?.storyboard)
        ? asRecord(storyboard).storyboard
        : null;
  if (!scenes?.length) return null;
  const compact = scenes.slice(0, 8).map((scene, index) => ({
    scene: Number(
      scene?.sceneNumber ?? scene?.scene_number ?? scene?.scene ?? index + 1,
    ),
    title: clip(scene?.title, 80),
    visual: clip(
      scene?.visualDescription ||
        scene?.visual ||
        scene?.description ||
        scene?.visualDirection,
      180,
    ),
  }));
  return compact.some((s) => s.title || s.visual) ? compact : null;
}

export function summarizeContentVersion(version) {
  if (!version) return null;
  const scenario = summarizeScenario(version.scenario);
  const narration = summarizeNarration(version.narration);
  const storyboard = summarizeStoryboard(version.storyboard);
  if (!scenario && !narration && !storyboard) return null;
  return {
    versionNumber: version.versionNumber ?? null,
    status: version.status || null,
    publishedToClient: Boolean(version.publishedToClient),
    ...(scenario ? { scenario } : {}),
    ...(narration ? { narration } : {}),
    ...(storyboard ? { storyboard } : {}),
  };
}

export function pickContentVersion(versions = []) {
  if (!Array.isArray(versions) || !versions.length) return null;
  const scored = [...versions].map((version) => {
    let score = Number(version.versionNumber || 0);
    if (version.status === 'APPROVED') score += 100;
    else if (version.publishedToClient) score += 60;
    else if (version.status === 'UNDER_REVIEW') score += 20;
    return { version, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.version || null;
}

export function buildPortfolioAiInput(project, video = null) {
  const brief = publicSafeBrief(project.brief);
  const customer = publicSafeCustomer(project.crmCustomer, project.brief);
  const content = summarizeContentVersion(
    pickContentVersion(project.contentVersions),
  );
  return {
    projectId: project.id,
    projectTitle: project.title,
    projectCode: project.code,
    serviceName: project.service?.name || null,
    formatName: project.format?.name || project.format?.ratio || null,
    language: project.language || 'fa',
    tone: project.tone || null,
    platforms: project.platforms || null,
    durationSec: project.durationSec || null,
    brief,
    customer,
    video: video
      ? {
          name: clip(video.name, 120),
          kind: video.kind || null,
          videoType: video.videoType || null,
        }
      : null,
    content,
    outputSchema: {
      title: 'string (Persian marketing title, max ~70 chars)',
      description: 'string (2-4 sentence public card blurb, min 20 chars)',
      successStory:
        'string (public Success Story prose, min ~80 chars; prefer 180-420 words)',
    },
  };
}

function fieldsFromRecord(rec) {
  const root = unwrapNestedRecord(rec);
  return {
    title: pickField(root, TITLE_KEYS, PORTFOLIO_TITLE_MAX),
    description: pickField(root, DESCRIPTION_KEYS, PORTFOLIO_DESCRIPTION_MAX),
    successStory: pickField(
      root,
      SUCCESS_STORY_KEYS,
      PORTFOLIO_SUCCESS_STORY_MAX,
    ),
  };
}

function unwrapAiJson(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    // Provider completion objects: prefer .text / .content, else treat as payload.
    if (typeof raw.text === 'string' || typeof raw.content === 'string') {
      const nested = unwrapAiJson(raw.text || raw.content);
      if (nested) return nested;
    }
    const direct = fieldsFromRecord(raw);
    if (direct.title || direct.description || direct.successStory) {
      return direct;
    }
    if (typeof raw.raw === 'string') {
      const nested = unwrapAiJson(raw.raw);
      if (nested) return nested;
    }
  }

  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return null;

  const extracted = extractJson(text);
  if (extracted && typeof extracted === 'object' && !extracted.raw) {
    const fromJson = fieldsFromRecord(extracted);
    if (fromJson.title || fromJson.description || fromJson.successStory) {
      return fromJson;
    }
  }
  return null;
}

export function parsePortfolioAiJson(raw, createAiError) {
  const fail = (message, extra) => {
    if (typeof createAiError === 'function') {
      throw createAiError(message, extra);
    }
    const err = new Error(message);
    Object.assign(err, extra || {});
    throw err;
  };
  const parsed = unwrapAiJson(raw);
  if (!parsed) {
    fail('خروجی هوش مصنوعی نامعتبر است', {
      code: 'invalid_json',
      status: 502,
    });
  }
  const title = parsed.title;
  const description = parsed.description;
  let successStory = parsed.successStory;
  if (!successStory && description.length >= PORTFOLIO_SUCCESS_STORY_MIN) {
    successStory = description;
  }
  if (
    title.length < 3 ||
    description.length < 20 ||
    successStory.length < PORTFOLIO_SUCCESS_STORY_MIN
  ) {
    fail('عنوان، توضیحات یا داستان موفقیت تولیدشده کافی نیست', {
      code: 'invalid_portfolio_output',
      status: 502,
    });
  }
  return {
    title: title.slice(0, PORTFOLIO_TITLE_MAX),
    description: description.slice(0, PORTFOLIO_DESCRIPTION_MAX),
    successStory: successStory.slice(0, PORTFOLIO_SUCCESS_STORY_MAX),
  };
}

export function mockPortfolioCopy(project) {
  const service = project.service?.name || 'ویدیوی تبلیغاتی';
  const format = project.format?.name ? ` در قالب ${project.format.name}` : '';
  const tone = project.tone ? ` با لحن ${project.tone}` : '';
  const brief = publicSafeBrief(project.brief);
  const goal = brief?.goal || 'معرفی برند و جذب مخاطب هدف';
  const audience = brief?.audience || 'مخاطبان هدف کسب‌وکار';
  const company = publicSafeCustomer(project.crmCustomer, project.brief)
    ?.companyName;

  const title = `${service} حرفه‌ای`.slice(0, PORTFOLIO_TITLE_MAX);
  const description = (
    `نمونه‌کاری از تولید ${service}${format}${tone} با رویکردی حرفه‌ای و متناسب با برند.` +
    ' این اثر برای نمایش کیفیت تولید ویدیو در اپیکس منتشر شده است.'
  ).slice(0, PORTFOLIO_DESCRIPTION_MAX);

  const brand = company ? `برای ${company}` : 'برای این برند';
  const successStory = [
    `هدف پروژه`,
    `این ویدیو ${brand} طراحی شد تا ${goal} را به‌صورت تصویری و قابل‌اعتماد روایت کند و مسیر تصمیم مخاطب را روشن‌تر سازد.`,
    `تکنیک‌های بازاریابی و فروش`,
    `روایت بر معرفی ارزش محصول/خدمت، پیام شفاف و دعوت به اقدام متکی است${tone ? ` و لحن ${project.tone} را حفظ می‌کند` : ''}. در صورت وجود جایگاه برند، هویت بصری در خدمت اقناع و به‌خاطرسپاری پیام قرار گرفته است.`,
    `نقاط قوت ویدیو`,
    `قوت این اثر در داستان‌گویی منسجم، ارائه حرفه‌ای و تمرکز روی پیام اصلی است${format ? `؛ قالب ${project.format.name} برای پلتفرم‌های نمایش انتخاب شده است` : ''}.`,
    `جذب مخاطب`,
    `شروع هدفمند و ریتم مناسب کمک می‌کند توجه ${audience} حفظ شود و پیام تا دعوت پایانی دنبال شود.`,
    `اثرگذاری کسب‌وکار`,
    `این ویدیو می‌تواند اعتماد و اعتبار برند را تقویت کند، مشتریان بالقوه را جذب نماید، تعامل را افزایش دهد و مسیر تبدیل و فروش را پشتیبانی کند. هیچ آمار عملکردی در این متن ادعا نشده است.`,
  ].join('\n\n');

  return {
    title,
    description,
    successStory: successStory.slice(0, PORTFOLIO_SUCCESS_STORY_MAX),
  };
}
