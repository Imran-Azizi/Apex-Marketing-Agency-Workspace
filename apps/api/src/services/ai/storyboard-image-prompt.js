/**
 * Builds scene-first, project-aware prompts for storyboard still-image generation.
 * Scene action / shot type lead the prompt so image models cannot ignore them.
 */

export const STORYBOARD_IMAGE_SIZE = '1920x1080';

const QUALITY_SUFFIX =
  'Premium commercial cinematography still, 16:9 widescreen, shot on 35mm cinema camera, ARRI Alexa look, sharp focus, rich texture, cinematic color grade, photoreal, professional lighting, no illustration, no sci-fi, no anime, no fashion portrait, no watermark, no unreadable text.';

const FA_EN_HINTS = [
  [/سرک|جاده|راه/g, 'road'],
  [/خراب|تخریب|چاله|ویران/g, 'damaged potholed broken'],
  [/ترافیک|ترافیکی/g, 'traffic congestion'],
  [/موتر|ماشین|خودرو|موترها/g, 'cars vehicles'],
  [/کارگر/g, 'construction workers'],
  [/ساختمان|عمران|ساخت‌وساز|ساخت و ساز|ساخت/g, 'civil construction'],
  [/مسطح|صاف|آسفالت/g, 'smooth newly paved asphalt'],
  [/تماس|شماره تماس|تلفن/g, 'phone number contact call-to-action'],
  [/لوگو|نشان/g, 'company logo'],
  [/کارخانه|فابریکه/g, 'factory'],
  [/محصول|نوشیدنی/g, 'product'],
  [/دفتر|محل کار/g, 'office workplace'],
  [/ورزش|تحرک/g, 'exercise activity'],
  [/خستگی/g, 'fatigue tired worker'],
  [/نظرات|مشتری/g, 'customer interview testimonial'],
  [/ماشین آلات|رولر|غلتک/g, 'heavy construction machinery steamroller paver'],
  [/دعوت به اقدام|اقدام/g, 'call to action company branding'],
  [/نوشابه|انرژی|energy drink/gi, 'energy drink product can'],
  [/برند|brand/gi, 'brand identity'],
];

function toAscii(text) {
  return str(text)
    .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g, ' ')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function expandConcreteSubject(hints, blob, brand = {}) {
  const product = toAscii(brand.productName || brand.productDescription);
  const h = `${hints} ${blob} ${product}`.toLowerCase();

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
  if (/energy drink|beverage|drink can|product can/.test(h) || (/product/.test(h) && product)) {
    return `hero product shot of ${product || 'the branded product'} in a premium advertising setting that matches this scene`;
  }
  if (/factory/.test(h)) {
    return 'a clean industrial factory floor with real equipment and workers, premium corporate film still';
  }
  if (/office|workplace|fatigue/.test(h)) {
    return 'a realistic office workplace matching the scene action, premium commercial still';
  }
  if (/road/.test(h) && /construction|civil/.test(h)) {
    return 'civil road construction on an urban street, engineering vehicles and fresh asphalt, cinematic commercial photography';
  }

  const ascii = toAscii(blob);
  if (product && ascii) return `${product}, ${ascii}`;
  if (hints && ascii) return `${hints}, ${ascii}`;
  if (product) return product;
  if (hints) return hints;
  if (ascii) return ascii;
  return '';
}

export function buildProductionBible(brand = {}, scenario = {}, styleGuide = '') {
  const identity = [
    toAscii(brand.productName),
    toAscii(brand.customerName),
    toAscii(brand.projectTitle),
    toAscii(scenario.concept),
    toAscii(scenario.emotionalDirection),
    toAscii(brand.tone),
    toAscii(styleGuide),
  ]
    .filter(Boolean)
    .slice(0, 5);
  if (!identity.length) {
    return 'Same premium commercial production across frames: consistent color grade, lens, and lighting.';
  }
  return `Same premium commercial production throughout: ${identity.join('; ')}. Consistent color grade, lens language, and lighting.`;
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
  return /Ultra-sharp professional|Avoid: blurry|Storyboard frame \d+ of|Photorealistic 16:9 cinematic production still|Premium commercial cinematography still|WIDE ESTABLISHING SHOT|Same premium commercial production/i.test(
    str(text),
  );
}

function persianHints(text) {
  const src = str(text);
  if (!src) return '';
  const hits = [];
  for (const [re, en] of FA_EN_HINTS) {
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
        'CLOSE-UP: fill the frame with the exact subject of this scene (the object, product, sign, road detail, or person named below). Tight framing on that subject only.',
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
  return /person|man|woman|worker|driver|character|people|crowd|مرد|زن|کارگر|راننده|شخص|افراد|چهره/i.test(
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
    customerName: str(customer.companyName || customer.personName),
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
  return clip(raw, 500);
}

export function validateImagePrompt(prompt, scene = {}) {
  const text = str(prompt);
  if (text.length < 36) {
    return { ok: false, error: 'پرامپت تصویر برای این صحنه کافی نیست' };
  }
  const visual = str(
    scene.visualDescription || scene.visual || scene.title || scene.environment,
  );
  if (!visual && text.length < 80) {
    return { ok: false, error: 'جزئیات صحنه برای تولید تصویر کافی نیست' };
  }
  return { ok: true };
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
  } = {},
) {
  const brand = projectContext || {};
  const scenario = scenarioContext || {};
  const shot = resolveShotType(scene);
  const visual = str(scene.visualDescription || scene.visual || scene.description);
  const action = str(scene.characterActions || scene.action || scene.motion);
  const environment = str(scene.environment);
  const lighting = toAscii(scene.lighting) || toAscii(scene.visualDirection);
  const mood = toAscii(scene.visualDirection);
  const camera = toAscii(scene.camera || scene.cameraAngle);
  const beat = scenarioBeatForScene(scenario, sceneIndex);
  const llmPrompt = toAscii(originalLlmPrompt(scene));
  const sceneNo = Number(scene.sceneNumber ?? scene.scene_number ?? sceneIndex + 1);

  const blob = [
    scene.title,
    visual,
    action,
    environment,
    beat,
    brand.projectTitle,
    brand.productName,
    brand.productDescription,
    scenario.concept,
    narrationContext,
    customPrompt,
  ]
    .filter(Boolean)
    .join(' ');
  const hints = persianHints(blob);
  const subject =
    expandConcreteSubject(hints, blob, brand) ||
    llmPrompt ||
    toAscii(visual) ||
    toAscii(environment) ||
    toAscii(action) ||
    toAscii(brand.productName) ||
    toAscii(brand.projectTitle) ||
    'the exact subject of this commercial storyboard scene';

  const shotLead =
    shot.key === 'wide'
      ? 'WIDE ESTABLISHING SHOT, environment fills the 16:9 frame, of'
      : shot.key === 'medium'
        ? 'MEDIUM SHOT, cinematic commercial framing, of'
        : shot.key === 'close-up'
          ? 'CLOSE-UP, shallow depth of field on the scene subject, of'
          : 'Photoreal 16:9 commercial still of';

  const allowPerson =
    shot.key === 'close-up' && sceneMentionsPerson(scene, `${hints} ${subject}`);

  const bible = buildProductionBible(brand, scenario, styleGuide);

  const prompt = [
    `${shotLead} ${subject}.`,
    camera ? `Camera: ${camera}.` : null,
    lighting ? `Light: ${lighting}.` : mood ? `Mood: ${mood}.` : null,
    toAscii(environment) ? `Location: ${toAscii(environment)}.` : null,
    toAscii(action) ? `Action: ${toAscii(action)}.` : null,
    toAscii(narrationContext)
      ? `Narration beat: ${clip(toAscii(narrationContext), 120)}.`
      : null,
    toAscii(brand.productName) ? `Brand/product: ${toAscii(brand.productName)}.` : null,
    toAscii(brand.mainMessage) ? `Campaign message: ${clip(toAscii(brand.mainMessage), 90)}.` : null,
    bible,
    `Unique storyboard frame ${sceneNo} of ${totalScenes}.`,
    allowPerson
      ? 'Person must match the role in this scene, realistic documentary, not a fashion model.'
      : 'No portrait, no woman close-up, no sci-fi character, no random face. Show the location and action of THIS scene only.',
    str(customPrompt) ? `Revision: ${clip(toAscii(customPrompt) || customPrompt, 160)}.` : null,
    QUALITY_SUFFIX,
  ]
    .filter(Boolean)
    .join(' ');

  return clip(toAscii(prompt) || prompt, 900);
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
