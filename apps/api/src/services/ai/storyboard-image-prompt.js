/**
 * Builds scene-first, project-aware prompts for storyboard still-image generation.
 * Exact scene description leads; brand/scenario/narration ground the frame.
 */

import { getCustomerPersonName } from '../../utils/crmCustomerName.js';

export const STORYBOARD_IMAGE_SIZE = '1920x1080';
export const STORYBOARD_COLLAGE_SIZE = '1920x1080';

const QUALITY_SUFFIX =
  'Premium commercial advertising cinematography still, 16:9 widescreen, sharp focus, professional three-point lighting, cinematic color grade, photoreal product-or-service storytelling, unique to this exact scene, no illustration, no anime, no fashion portrait, no watermark, no unreadable text, no collage.';

const COLLAGE_QUALITY_SUFFIX =
  'Photoreal commercial frames inside a professional cinematic storyboard sheet, matching color grade, lens language, wardrobe, and lighting across every panel, clean equal gutters, dark slate mount, no messy photo dump, no overlapping panels, no watermark, no unreadable in-world text.';

/**
 * Persian → English domain hints.
 * IMPORTANT: do not map bare "انرژی" to energy-drink — that breaks electric-energy projects.
 */
const FA_EN_HINTS = [
  [/انرژی الکتریکی|برق شهری|شبکه برق|الکتریکی|electrical energy|electric energy/gi, 'electric energy electrical power grid'],
  [/انرژی خورشیدی|پنل خورشیدی|خورشیدی|solar panel|solar energy/gi, 'solar energy solar panels'],
  [/انرژی تجدیدپذیر|تجدیدپذیر|renewable/gi, 'renewable energy'],
  [/هوشمند سافت|نرم[\s\-‌]?افزار|سافت[\s\-‌]?ویر|software|saas/gi, 'smart software digital product'],
  [/هوشمند|smart system|iot/gi, 'smart intelligent technology'],
  [/برق|power line|transformer|کابل برق/gi, 'electricity power lines electrical infrastructure'],
  [/مصرف برق|قبض برق|هزینه انرژی|energy bill/gi, 'electricity consumption energy bill'],
  [/خانه هوشمند|smart home/gi, 'smart home living space'],
  [/کارخانه|فابریکه|industrial plant/gi, 'factory industrial plant'],
  [/محصول دیجیتال|اپلیکیشن|اپ|dashboard|داشبورد/gi, 'digital product app dashboard interface'],
  [/نوشابه|نوشیدنی انرژی[\s\-‌]?زا|energy drink/gi, 'energy drink product can'],
  [/سرک|جاده|راه/g, 'road'],
  [/خراب|تخریب|چاله|ویران/g, 'damaged potholed broken'],
  [/ترافیک|ترافیکی/g, 'traffic congestion'],
  [/موتر|ماشین|خودرو|موترها/g, 'cars vehicles'],
  [/کارگر/g, 'construction workers'],
  [/ساختمان|عمران|ساخت‌وساز|ساخت و ساز|ساخت/g, 'civil construction'],
  [/مسطح|صاف|آسفالت/g, 'smooth newly paved asphalt'],
  [/تماس|شماره تماس|تلفن/g, 'phone number contact call-to-action'],
  [/لوگو|نشان/g, 'company logo'],
  [/محصول(?!\s*دیجیتال)|نوشیدنی(?!\s*انرژی)/g, 'product'],
  [/دفتر کار|محل کار|اداره/g, 'office workplace'],
  [/ورزش|تحرک/g, 'exercise activity'],
  [/خستگی/g, 'fatigue tired worker'],
  [/نظرات|مشتری|مصاحبه/g, 'customer interview testimonial'],
  [/ماشین آلات|رولر|غلتک/g, 'heavy construction machinery steamroller paver'],
  [/دعوت به اقدام|اقدام به تماس/g, 'call to action company branding'],
  [/برند|brand/gi, 'brand identity'],
  [/خانواده|پدر|مادر|فرزند/g, 'family at home'],
  [/مهندس|تکنسین|متخصص/g, 'engineer technician specialist'],
  [/نمایشگر|مانیتور|صفحه نمایش|صفحه/g, 'display screen monitor'],
  [/شهر|خیابان|محله/g, 'city street neighborhood'],
  [/(?:^|[^\u0600-\u06FF])شب(?:[^\u0600-\u06FF]|$)|تاریک|نورپردازی|شبانه/g, 'night lighting atmosphere'],
  [/روز|آفتاب|صبح|نور طبیعی/g, 'daytime sunlight'],
  [/مبل|مبلمان|کاناپه|sofa|couch|furniture/gi, 'furniture sofa living room'],
  [/راحتی|لوکس|لوکسی|luxury|comfort/gi, 'luxury comfort'],
  [/اتاق نشیمن|سالن|پذیرایی|living room/gi, 'living room interior'],
  [/خانه|منزل|home|house/gi, 'home interior'],
];

/** Generic portrait / unrelated traps that must not dominate commercial scenes. */
const GENERIC_TRAP_RE =
  /\bfashion portrait\b|\bheadshot\b|\bglamour\b|\bmodel posing\b|\bcinematic portrait of a (?:woman|man|person)\b|\bdark moody (?:office )?portrait\b/i;

function toAscii(text) {
  return str(text)
    .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g, ' ')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Translate Persian commercial copy into English keywords + keep existing Latin text. */
export function localizeVisualText(text) {
  const src = str(text);
  if (!src) return '';
  const hints = persianHints(src);
  const ascii = toAscii(src);
  if (hints && ascii) return `${hints}. ${ascii}`.trim();
  if (hints) return hints;
  return ascii;
}

function expandConcreteSubject(hints, blob, brand = {}) {
  const product = toAscii(brand.productName || brand.productDescription);
  const service = toAscii(brand.service);
  const h = `${hints} ${blob} ${product} ${service}`.toLowerCase();

  if (/electric energy|electrical power|electricity power|power grid/.test(h)) {
    return `electric energy / smart power visuals for ${product || service || 'the electric energy brand'}, infrastructure, meters, or clean power technology matching THIS scene`;
  }
  if (/solar energy|solar panel/.test(h)) {
    return `solar energy installation and panels for ${product || 'the solar brand'}, matching THIS scene`;
  }
  if (/smart software|digital product|app dashboard|smart intelligent/.test(h)) {
    return `smart software / digital energy product experience for ${product || 'the software brand'}, UI or real-world usage matching THIS scene`;
  }
  if (/pothole|damaged|broken/.test(h) && /road/.test(h)) {
    return 'a badly damaged city asphalt road full of potholes and cracks, cars crawling slowly through traffic, documentary commercial frame';
  }
  if (/machinery|paver|steamroller|worker/.test(h) && /road|construction/.test(h)) {
    return 'an active premium road construction site with asphalt paver, steamroller, dump trucks, and skilled workers in yellow vests laying fresh asphalt';
  }
  if (/customer|interview|testimonial/.test(h)) {
    return 'a satisfied local customer speaking on camera beside the finished work, premium documentary interview still';
  }
  if (/call to action|logo|branding|contact/.test(h) && /road|construction|civil/.test(h)) {
    return 'a premium civil-engineering company exterior or branded roadside sign at dusk, cinematic commercial still, no fake readable text';
  }
  if (/energy drink|beverage|drink can|product can/.test(h)) {
    return `hero product shot of ${product || 'the branded energy drink'} in a premium advertising setting that matches this scene`;
  }
  if (/furniture|sofa|couch|living room/.test(h)) {
    return `premium furniture / sofa product in a stylish living room for ${product || 'the furniture brand'}, matching THIS scene exactly, photoreal home interior commercial still`;
  }
  if (/factory|industrial plant/.test(h)) {
    return 'a clean industrial factory floor with real equipment and workers, premium corporate film still';
  }
  if (/road/.test(h) && /construction|civil/.test(h)) {
    return 'civil road construction on an urban street, engineering vehicles and fresh asphalt, cinematic commercial photography';
  }

  const ascii = toAscii(blob);
  if (product && ascii) return `${product}, ${ascii}`;
  if (service && ascii) return `${service}, ${ascii}`;
  if (hints && ascii) return `${hints}, ${ascii}`;
  if (product) return product;
  if (service) return service;
  if (hints) return hints;
  if (ascii) return ascii;
  return '';
}

export function buildProductionBible(brand = {}, scenario = {}, styleGuide = '') {
  const identity = [
    toAscii(brand.productName),
    toAscii(brand.service),
    toAscii(brand.customerName),
    toAscii(brand.projectTitle),
    toAscii(scenario.concept),
    toAscii(scenario.emotionalDirection),
    toAscii(brand.tone),
    toAscii(styleGuide),
  ]
    .filter(Boolean)
    .slice(0, 6);
  if (!identity.length) {
    return 'Same premium commercial production across frames: consistent color grade, lens, wardrobe, locations, and lighting.';
  }
  return `Same premium commercial production throughout: ${identity.join('; ')}. Consistent characters, product look, locations language, color grade, lens, and lighting across related scenes.`;
}

function str(v) {
  if (v == null) return '';
  return String(v).trim();
}

function clip(v, max) {
  const s = str(v);
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trim()}…`;
}

function pickBriefField(brief, ...keys) {
  if (!brief || typeof brief !== 'object') return '';
  for (const key of keys) {
    const val = brief[key];
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  return '';
}

function briefFeatures(brief) {
  if (!brief || typeof brief !== 'object') return '';
  const features = brief.features;
  if (Array.isArray(features)) {
    return features.filter(Boolean).slice(0, 6).join(', ');
  }
  if (typeof features === 'string') return features.trim();
  return '';
}

function isWrapperPrompt(text) {
  // Detect prompts we already composed — not legitimate LLM shot leads like "Wide establishing shot of…"
  return /Ultra-sharp professional|Avoid: blurry|Storyboard frame \d+ of|Photorealistic 16:9 cinematic production still|Premium commercial cinematography still|Same premium commercial production throughout|ONE full-frame 16:9 cinema still|MUST SHOW:|MUST NOT SHOW:|REGENERATION: previous output/i.test(
    str(text),
  );
}

function persianHints(text) {
  const src = str(text);
  if (!src) return '';
  const hits = [];
  for (const [re, en] of FA_EN_HINTS) {
    re.lastIndex = 0;
    if (re.test(src)) hits.push(en);
  }
  return [...new Set(hits)].join(', ');
}

export function resolveShotType(scene = {}) {
  const raw = [
    scene.camera,
    scene.cameraAngle,
    scene.visualDirection,
    scene.title,
    scene.visualDescription,
    scene.visual,
  ]
    .filter(Boolean)
    .join(' ');

  if (
    /close[- ]?up|closeup|ecu|extreme close|کلوز|کلوزآپ|نمای نزدیک|نما نزدیک/i.test(
      raw,
    )
  ) {
    return {
      key: 'close-up',
      instruction:
        'CLOSE-UP: fill the frame with the exact subject of this scene (the object, product, sign, interface, or person named below). Tight framing on that subject only.',
    };
  }

  if (/medium|mid[- ]shot|\bms\b|مدیوم|نمای متوسط|نما متوسط/i.test(raw)) {
    return {
      key: 'medium',
      instruction:
        'MEDIUM SHOT: frame the subject from about the waist up or at mid-distance so the action and nearby environment are both visible. Not a face portrait, not an extreme wide.',
    };
  }

  if (
    /wide|long shot|establishing|\bls\b|aerial|drone|واید|عریض|نمای باز|نما باز|نمای وسیع/i.test(
      raw,
    )
  ) {
    return {
      key: 'wide',
      instruction:
        'WIDE ESTABLISHING SHOT: the environment and situation dominate the frame. Show the full location. Any people are small in the frame. Do NOT crop to a face. Do NOT generate a portrait.',
    };
  }

  return {
    key: 'cinematic',
    instruction:
      'Cinematic 16:9 production still of the exact location and action described. Frame the scene, not a random portrait.',
  };
}

function sceneMentionsPerson(scene, extra = '') {
  return /person|man|woman|worker|driver|character|people|crowd|engineer|technician|customer|family|مرد|زن|کارگر|راننده|شخص|افراد|چهره|مهندس|تکنسین|مشتری|خانواده/i.test(
    [
      scene.title,
      scene.visualDescription,
      scene.visual,
      scene.characterActions,
      scene.action,
      extra,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

/** Extract brand/product context from project record + brief JSON. */
export function extractProjectBrandContext(project = {}) {
  const brief = project.brief && typeof project.brief === 'object' ? project.brief : {};
  const customer = project.crmCustomer || {};

  return {
    projectTitle: str(project.title),
    projectCode: str(project.code),
    service: str(project.service?.name),
    format: str(project.format?.ratio),
    durationSec: project.durationSec || null,
    language: str(project.language),
    tone: str(project.tone || brief.tone),
    customerName: str(getCustomerPersonName(customer, '')),
    productName: pickBriefField(brief, 'productName', 'brandName', 'product'),
    productDescription: pickBriefField(
      brief,
      'productDescription',
      'productDetails',
      'description',
    ),
    mainMessage: pickBriefField(brief, 'mainMessage', 'message', 'goal'),
    audience: pickBriefField(brief, 'audience', 'targetAudience'),
    cta: pickBriefField(brief, 'cta', 'callToAction'),
    features: briefFeatures(brief),
    managerNotes: pickBriefField(brief, 'managerNotes'),
    mandatoryTexts: pickBriefField(brief, 'mandatoryTexts'),
    brandLimits: pickBriefField(brief, 'brandLimits'),
    referenceAssets: [
      ...(Array.isArray(project.files) ? project.files : []),
      ...(Array.isArray(project.assetRefs)
        ? project.assetRefs.map((r) => r.clientAsset).filter(Boolean)
        : []),
    ]
      .filter((a) => a && /image|logo|reference|photo|product/i.test(str(a.kind || a.name)))
      .slice(0, 8)
      .map((a) => str(a.name))
      .filter(Boolean),
  };
}

/** Summarize scenario for image prompts. */
export function extractScenarioContext(scenario) {
  if (!scenario || typeof scenario !== 'object') return {};
  const picked =
    (Array.isArray(scenario.scenarios)
      ? scenario.scenarios.find((s) => s.id === scenario.recommendedScenarioId) ||
        scenario.scenarios[0]
      : null) || scenario;

  return {
    title: str(picked.title || scenario.title),
    concept: str(picked.concept || scenario.concept),
    hook: str(picked.hook || scenario.hook),
    problem: str(picked.problem || scenario.problem),
    solution: str(picked.solution || scenario.solution),
    storyFlow: str(picked.storyFlow || scenario.storyFlow || scenario.content),
    emotionalDirection: str(picked.emotionalDirection || scenario.emotionalDirection),
    marketingAngle: str(picked.marketingAngle || scenario.marketingAngle),
    cta: str(picked.cta || scenario.cta),
    sceneBreakdown: Array.isArray(picked.sceneBreakdown)
      ? picked.sceneBreakdown
      : Array.isArray(scenario.sceneBreakdown)
        ? scenario.sceneBreakdown
        : [],
  };
}

/** Best-effort narration snippet aligned to scene index. */
export function extractSceneNarrationHint(narration, sceneIndex, totalScenes) {
  const script = str(narration?.script);
  if (!script) return '';

  const paragraphs = script
    .split(/\n{2,}|(?:\.\s+(?=[\u0600-\u06FFA-Z]))/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length >= totalScenes && totalScenes > 0) {
    return paragraphs[sceneIndex] || paragraphs[Math.min(sceneIndex, paragraphs.length - 1)];
  }

  const sentences = script
    .split(/(?<=[.!?؟])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!sentences.length) return script.slice(0, 220);

  const perScene = Math.max(1, Math.ceil(sentences.length / Math.max(totalScenes, 1)));
  const start = sceneIndex * perScene;
  return sentences.slice(start, start + perScene).join(' ').slice(0, 220);
}

function scenarioBeatForScene(scenarioCtx, sceneIndex) {
  const beats = scenarioCtx.sceneBreakdown || [];
  if (!beats.length) return '';
  const beat = beats[sceneIndex] || beats[Math.min(sceneIndex, beats.length - 1)];
  if (!beat || typeof beat !== 'object') return str(beat);
  return [beat.title, beat.description, beat.visual, beat.action, beat.hook]
    .filter(Boolean)
    .join('. ')
    .slice(0, 220);
}

function originalLlmPrompt(scene) {
  const raw = str(scene.imagePrompt || scene.image_prompt);
  if (!raw || isWrapperPrompt(raw)) return '';
  return clip(raw, 520);
}

/** Collect grounding tokens from project + scene for validation. */
export function collectGroundingTokens({
  scene = {},
  projectContext = {},
  scenarioContext = {},
  narrationContext = '',
} = {}) {
  const brand = projectContext || {};
  const scenario = scenarioContext || {};
  const parts = [
    brand.productName,
    brand.productDescription,
    brand.projectTitle,
    brand.service,
    brand.mainMessage,
    brand.audience,
    scenario.concept,
    scenario.hook,
    scenario.problem,
    scenario.solution,
    scene.title,
    scene.visualDescription || scene.visual || scene.description,
    scene.characterActions || scene.action,
    scene.environment,
    scene.lighting,
    scene.visualDirection,
    narrationContext,
  ]
    .map((v) => localizeVisualText(v) || toAscii(v))
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const stop = new Set([
    'the',
    'and',
    'with',
    'from',
    'this',
    'that',
    'into',
    'onto',
    'over',
    'under',
    'scene',
    'shot',
    'camera',
    'frame',
    'video',
    'commercial',
    'cinematic',
    'premium',
    'still',
    'image',
    'show',
    'must',
    'only',
  ]);

  const tokens = parts
    .replace(/[^a-z0-9\s\-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !stop.has(t));

  return [...new Set(tokens)].slice(0, 24);
}

export function validateImagePrompt(prompt, scene = {}, context = {}) {
  const text = str(prompt);
  if (text.length < 36) {
    return { ok: false, error: 'پرامپت تصویر برای این صحنه کافی نیست', grounded: false };
  }

  const visual = str(
    scene.visualDescription || scene.visual || scene.title || scene.environment,
  );
  if (!visual && text.length < 80) {
    return { ok: false, error: 'جزئیات صحنه برای تولید تصویر کافی نیست', grounded: false };
  }

  if (GENERIC_TRAP_RE.test(text) && !sceneMentionsPerson(scene)) {
    return {
      ok: false,
      error: 'پرامپت به پرترهٔ عمومی منحرف شده و با صحنه هم‌خوان نیست',
      grounded: false,
    };
  }

  const tokens = collectGroundingTokens({
    scene,
    projectContext: context.projectContext,
    scenarioContext: context.scenarioContext,
    narrationContext: context.narrationContext,
  });
  if (tokens.length >= 3) {
    const lower = text.toLowerCase();
    const hits = tokens.filter((t) => lower.includes(t)).length;
    const ratio = hits / Math.min(tokens.length, 8);
    if (hits < 2 && ratio < 0.25) {
      return {
        ok: false,
        error: 'پرامپت تصویر به محتوای پروژه و صحنه متصل نیست',
        grounded: false,
      };
    }
    return { ok: true, grounded: hits >= 2, groundingHits: hits };
  }

  return { ok: true, grounded: true };
}

export function validateCollagePrompt(prompt, sceneCount = 1) {
  const text = str(prompt);
  if (text.length < 80) {
    return { ok: false, error: 'پرامپت شیت استوری‌بورد کافی نیست' };
  }
  const n = Math.max(1, Number(sceneCount) || 1);
  if (n > 1 && !/panel|grid|sheet|storyboard/i.test(text)) {
    return { ok: false, error: 'پرامپت شیت استوری‌بورد باید همه صحنه‌ها را در یک تصویر توصیف کند' };
  }
  return { ok: true };
}

/**
 * Balanced panel grid for a single storyboard sheet.
 * Always one image; scene count only changes columns/rows.
 */
export function collageGrid(sceneCount) {
  const n = Math.max(1, Number(sceneCount) || 1);
  if (n === 1) return { cols: 1, rows: 1 };
  if (n === 2) return { cols: 2, rows: 1 };
  if (n === 3) return { cols: 3, rows: 1 };
  if (n === 4) return { cols: 2, rows: 2 };
  if (n <= 6) return { cols: 3, rows: 2 };
  if (n <= 8) return { cols: 4, rows: 2 };
  if (n <= 9) return { cols: 3, rows: 3 };
  if (n <= 12) return { cols: 4, rows: 3 };
  const cols = 4;
  return { cols, rows: Math.ceil(n / cols) };
}

function compactPanelLine(scene, ctx, sceneIndex, totalScenes) {
  const brand = ctx.projectContext || {};
  const sceneNo = Number(scene.sceneNumber ?? scene.scene_number ?? sceneIndex + 1);
  const shot = resolveShotType(scene);
  const visual = localizeVisualText(
    scene.visualDescription || scene.visual || scene.description,
  );
  const action = localizeVisualText(scene.characterActions || scene.action || scene.motion);
  const environment = localizeVisualText(scene.environment);
  const blob = [
    scene.title,
    visual,
    action,
    environment,
    brand.productName,
    brand.projectTitle,
    brand.service,
  ]
    .filter(Boolean)
    .join(' ');
  const hints = persianHints(blob);
  const subject =
    expandConcreteSubject(hints, blob, brand) ||
    visual ||
    environment ||
    action ||
    toAscii(scene.title) ||
    `the exact subject of scene ${sceneNo}`;
  const lighting = localizeVisualText(scene.lighting || scene.visualDirection);
  const narrationHint = localizeVisualText(
    extractSceneNarrationHint(ctx.narration, sceneIndex, totalScenes),
  );
  return [
    `Panel ${sceneNo} (${shot.key}): ${clip(subject, 160)}`,
    environment ? `location ${clip(environment, 70)}` : null,
    action ? `action ${clip(action, 80)}` : null,
    lighting ? `light ${clip(lighting, 60)}` : null,
    narrationHint ? `beat ${clip(narrationHint, 60)}` : null,
  ]
    .filter(Boolean)
    .join('; ')
    .concat('.');
}

/**
 * One English prompt that asks the image model for a complete storyboard sheet.
 */
export function buildCollageImagePrompt(
  scenes,
  {
    styleGuide,
    projectContext,
    scenarioContext,
    narration,
  } = {},
) {
  const list = Array.isArray(scenes) ? scenes.filter(Boolean) : [];
  const n = Math.max(1, list.length);
  const grid = collageGrid(n);
  const brand = projectContext || {};
  const scenario = scenarioContext || {};
  const bible = buildProductionBible(brand, scenario, styleGuide);
  const ctx = { projectContext: brand, narration };

  const layout =
    n === 1
      ? 'The sheet is a single full-bleed cinematic still of scene 1.'
      : `Layout: exactly one ${grid.cols}-column by ${grid.rows}-row grid of equal 16:9 panels on a dark slate storyboard mount. Place scenes in order left-to-right, then top-to-bottom. Panel 1 is top-left. Unused cells stay empty dark gutter. Even thin spacing between panels. Small SCENE number in each panel gutter only.`;

  const panels = list.map((scene, index) =>
    compactPanelLine(scene, ctx, index, n),
  );

  const prompt = [
    `ONE professional cinematic storyboard SHEET in a single 16:9 image containing all ${n} scenes as organized panels. Do not output ${n} separate pictures.`,
    layout,
    'Keep characters, product, wardrobe, locations language, lighting recipe, and art direction consistent across every panel.',
    toAscii(brand.productName)
      ? `Brand/product: ${toAscii(brand.productName)}.`
      : null,
    toAscii(brand.service) ? `Service: ${toAscii(brand.service)}.` : null,
    toAscii(brand.projectTitle)
      ? `Project: ${clip(toAscii(brand.projectTitle), 80)}.`
      : null,
    toAscii(scenario.concept)
      ? `Concept: ${clip(toAscii(scenario.concept), 120)}.`
      : null,
    bible,
    ...panels,
    COLLAGE_QUALITY_SUFFIX,
  ]
    .filter(Boolean)
    .join(' ');

  return clip(toAscii(prompt) || prompt, 1800);
}

function resolveSceneSubject(scene, { brand, scenario, narrationContext, beat, llmPrompt }) {
  const visualFa = str(scene.visualDescription || scene.visual || scene.description);
  const actionFa = str(scene.characterActions || scene.action || scene.motion);
  const environmentFa = str(scene.environment);
  const visualEn = localizeVisualText(visualFa);
  const actionEn = localizeVisualText(actionFa);
  const environmentEn = localizeVisualText(environmentFa);
  const llmEn = toAscii(llmPrompt);

  const blob = [
    scene.title,
    visualFa,
    actionFa,
    environmentFa,
    beat,
    brand.projectTitle,
    brand.productName,
    brand.productDescription,
    brand.service,
    scenario.concept,
    narrationContext,
  ]
    .filter(Boolean)
    .join(' ');
  const hints = persianHints(blob);
  const domainHint = expandConcreteSubject(hints, blob, brand);

  // Prefer scene description grounded in brand/product — never let a bare LLM
  // imagePrompt replace the advertised product with a generic cinematic still.
  const brandLead = [toAscii(brand.productName), toAscii(brand.service), toAscii(brand.projectTitle)]
    .filter(Boolean)
    .slice(0, 2)
    .join(' — ');

  if (llmEn && llmEn.length >= 40 && !GENERIC_TRAP_RE.test(llmEn)) {
    const brandTokens = brandLead
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3)
      .slice(0, 3);
    const llmLower = llmEn.toLowerCase();
    const missingBrand =
      brandTokens.length > 0 &&
      !brandTokens.some((t) => llmLower.includes(t.toLowerCase()));
    const groundedLlm =
      brandLead && missingBrand ? `${brandLead}: ${llmEn}` : llmEn;
    return {
      subject: groundedLlm,
      visualEn,
      actionEn,
      environmentEn,
      hints,
      domainHint,
      source: 'llm',
    };
  }

  if (visualEn && visualEn.length >= 12) {
    const withBrand = brandLead ? `${brandLead}: ${visualEn}` : visualEn;
    return {
      subject: domainHint ? `${withBrand} (${domainHint})` : withBrand,
      visualEn,
      actionEn,
      environmentEn,
      hints,
      domainHint,
      source: 'visual',
    };
  }

  if (domainHint) {
    return {
      subject: brandLead ? `${brandLead}: ${domainHint}` : domainHint,
      visualEn,
      actionEn,
      environmentEn,
      hints,
      domainHint,
      source: 'domain',
    };
  }

  const fallback =
    environmentEn ||
    actionEn ||
    toAscii(brand.productName) ||
    toAscii(brand.service) ||
    toAscii(brand.projectTitle) ||
    'the exact subject of this commercial storyboard scene';

  return {
    subject: brandLead && fallback !== brandLead ? `${brandLead}: ${fallback}` : fallback,
    visualEn,
    actionEn,
    environmentEn,
    hints,
    domainHint,
    source: 'fallback',
  };
}

function buildMustShowMustNot({
  scene,
  brand,
  scenario,
  subject,
  allowPerson,
  shot,
}) {
  const mustShow = [
    toAscii(brand.productName),
    toAscii(brand.productDescription),
    toAscii(brand.service),
    toAscii(brand.mainMessage),
    Array.isArray(brand.features) ? toAscii(brand.features.slice(0, 3).join(', ')) : toAscii(brand.features),
    toAscii(scenario.concept),
    localizeVisualText(scene.visualDescription || scene.visual || scene.description),
    localizeVisualText(scene.characterActions || scene.action),
    localizeVisualText(scene.environment),
  ]
    .filter(Boolean)
    .slice(0, 6);

  const mustNot = [
    'no unrelated story',
    'no generic dark office portrait unless this scene requires it',
    'no fashion headshot',
    'no sci-fi/anime',
    'no multi-panel grid or other scenes',
    !allowPerson ? 'no random face filling the frame' : null,
    shot.key === 'wide' ? 'no close-up face crop' : null,
    /electric|solar|power|software|smart/i.test(`${subject} ${brand.productName} ${brand.service}`)
      ? 'no beverage can, unrelated construction, or fashion shoot'
      : null,
  ].filter(Boolean);

  return { mustShow, mustNot };
}

/**
 * English-only visual prompt. Image models ignore Persian and then fall back
 * to a generic cinematic portrait — so never send non-ASCII scene text.
 */
export function buildSceneImagePrompt(
  scene,
  {
    styleGuide,
    customPrompt,
    projectContext,
    scenarioContext,
    narrationContext,
    sceneIndex = 0,
    totalScenes = 1,
    reinforce = false,
  } = {},
) {
  const brand = projectContext || {};
  const scenario = scenarioContext || {};
  const shot = resolveShotType(scene);
  const lighting = localizeVisualText(scene.lighting) || localizeVisualText(scene.visualDirection);
  const mood = localizeVisualText(scene.visualDirection);
  const camera = localizeVisualText(scene.camera || scene.cameraAngle);
  const beat = localizeVisualText(scenarioBeatForScene(scenario, sceneIndex));
  const llmPrompt = originalLlmPrompt(scene);
  const sceneNo = Number(scene.sceneNumber ?? scene.scene_number ?? sceneIndex + 1);
  const narrationEn = localizeVisualText(narrationContext);

  const resolved = resolveSceneSubject(scene, {
    brand,
    scenario,
    narrationContext,
    beat,
    llmPrompt,
  });
  const { subject, visualEn, actionEn, environmentEn } = resolved;

  const shotLead =
    shot.key === 'wide'
      ? 'WIDE ESTABLISHING SHOT, environment fills the 16:9 frame, of'
      : shot.key === 'medium'
        ? 'MEDIUM SHOT, cinematic commercial framing, of'
        : shot.key === 'close-up'
          ? 'CLOSE-UP, shallow depth of field on the scene subject, of'
          : 'Photoreal 16:9 commercial still of';

  const allowPerson =
    sceneMentionsPerson(scene, `${resolved.hints} ${subject}`) &&
    (shot.key === 'close-up' || shot.key === 'medium' || /interview|testimonial|customer|family/i.test(subject));

  const bible = buildProductionBible(brand, scenario, styleGuide);
  const { mustShow, mustNot } = buildMustShowMustNot({
    scene,
    brand,
    scenario,
    subject,
    allowPerson,
    shot,
  });

  // Brand + scene constraints stay early so clip() cannot drop them.
  const prompt = [
    `${shotLead} ${subject}.`,
    shot.instruction,
    visualEn ? `Exact scene description (priority): ${clip(visualEn, 140)}.` : null,
    toAscii(brand.projectTitle) ? `Project: ${clip(toAscii(brand.projectTitle), 70)}.` : null,
    toAscii(brand.productName) ? `Brand/product: ${toAscii(brand.productName)}.` : null,
    toAscii(brand.productDescription)
      ? `Product details: ${clip(toAscii(brand.productDescription), 100)}.`
      : null,
    toAscii(brand.service) ? `Service: ${clip(toAscii(brand.service), 60)}.` : null,
    toAscii(brand.audience) ? `Target audience: ${clip(toAscii(brand.audience), 60)}.` : null,
    toAscii(brand.mainMessage)
      ? `Marketing objective: ${clip(toAscii(brand.mainMessage), 80)}.`
      : null,
    toAscii(scenario.concept) ? `Campaign concept: ${clip(toAscii(scenario.concept), 80)}.` : null,
    reinforce
      ? 'REGENERATION: previous output was unrelated. Obey the exact scene description and brand/product above with zero creative substitution.'
      : null,
    mustShow.length ? `MUST SHOW: ${clip(mustShow.join('; '), 160)}.` : null,
    `MUST NOT SHOW: ${mustNot.join('; ')}.`,
    camera ? `Camera: ${camera}.` : null,
    lighting ? `Light: ${lighting}.` : mood ? `Mood: ${mood}.` : null,
    environmentEn ? `Location: ${clip(environmentEn, 80)}.` : null,
    actionEn ? `Action: ${clip(actionEn, 80)}.` : null,
    narrationEn
      ? `Voice-over beat for THIS frame: ${clip(narrationEn, 100)}.`
      : null,
    beat ? `Scenario beat for THIS frame: ${clip(beat, 80)}.` : null,
    bible,
    `Unique storyboard frame ${sceneNo} of ${totalScenes} — same cast, product, and look as related scenes.`,
    'ONE full-frame 16:9 cinema still of THIS scene only.',
    allowPerson
      ? 'Any person must match the role in this scene, realistic documentary casting, not a fashion model.'
      : 'No portrait, no random face. Show the location and action of THIS scene only.',
    str(customPrompt) ? `Revision: ${clip(toAscii(customPrompt) || customPrompt, 120)}.` : null,
    QUALITY_SUFFIX,
  ]
    .filter(Boolean)
    .join(' ');

  return clip(toAscii(prompt) || prompt, reinforce ? 1250 : 1150);
}

/** Stricter prompt used when the first still fails relevance checks. */
export function buildReinforcedSceneImagePrompt(scene, options = {}) {
  return buildSceneImagePrompt(scene, { ...options, reinforce: true });
}

/**
 * Text-only relevance score for a generated still description / prompt pair.
 * Used when vision scoring is unavailable.
 */
export function scorePromptRelevance(prompt, scene = {}, context = {}) {
  const check = validateImagePrompt(prompt, scene, context);
  const tokens = collectGroundingTokens({
    scene,
    projectContext: context.projectContext,
    scenarioContext: context.scenarioContext,
    narrationContext: context.narrationContext,
  });
  const lower = str(prompt).toLowerCase();
  const brand = context.projectContext || {};
  const brandHit = [brand.productName, brand.service, brand.projectTitle]
    .map((v) => toAscii(v).toLowerCase())
    .filter((v) => v.length >= 4)
    .some((v) => lower.includes(v));

  if (!tokens.length) {
    return {
      relevant: check.ok !== false || brandHit,
      score: brandHit ? 0.7 : 0.55,
      reason: brandHit ? 'brand grounded' : 'no tokens',
    };
  }

  const hits = tokens.filter((t) => lower.includes(t)).length;
  const score = Math.min(1, (hits + (brandHit ? 2 : 0)) / Math.min(6, tokens.length));
  const relevant =
    brandHit ||
    hits >= 2 ||
    score >= 0.34 ||
    (check.ok && check.grounded !== false);

  return {
    relevant,
    score,
    reason: !relevant
      ? check.error || 'weak grounding'
      : brandHit
        ? 'brand grounded'
        : hits >= 2
          ? 'grounded'
          : 'acceptable',
    hits,
  };
}

/** Build a short English scene summary for vision relevance checks. */
export function buildSceneRelevanceSummary(scene, context = {}) {
  const brand = context.projectContext || {};
  const parts = [
    toAscii(brand.projectTitle),
    toAscii(brand.productName),
    toAscii(brand.service),
    localizeVisualText(scene.title),
    localizeVisualText(scene.visualDescription || scene.visual || scene.description),
    localizeVisualText(scene.characterActions || scene.action),
    localizeVisualText(scene.environment),
    localizeVisualText(context.narrationContext),
  ].filter(Boolean);
  return clip(parts.join('. '), 400);
}

/** Stable per-scene seed for distinct generations. */
export function sceneImageSeed(projectId, sceneNumber, salt = 0) {
  const base = `${projectId || 'apex'}:${sceneNumber}:${salt}`;
  let hash = 0;
  for (let i = 0; i < base.length; i += 1) {
    hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  }
  return (hash % 2_000_000_000) + 1;
}
