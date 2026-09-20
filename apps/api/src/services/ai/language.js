/**
 * Project language + tone helpers for Scenario / Narration / Storyboard.
 * The customer's selected language and tone are authoritative — never AI-invented.
 */

const LANGUAGE_CATALOG = Object.freeze({
  fa: {
    code: 'fa',
    label: 'فارسی / دری',
    writingLanguage: 'Dari/Persian (فارسی / دری)',
    rtl: true,
  },
  dari: {
    code: 'fa',
    label: 'فارسی / دری',
    writingLanguage: 'Dari/Persian (فارسی / دری)',
    rtl: true,
  },
  prs: {
    code: 'fa',
    label: 'فارسی / دری',
    writingLanguage: 'Dari/Persian (فارسی / دری)',
    rtl: true,
  },
  'fa-af': {
    code: 'fa',
    label: 'فارسی / دری',
    writingLanguage: 'Dari/Persian (فارسی / دری)',
    rtl: true,
  },
  'fa-ir': {
    code: 'fa',
    label: 'فارسی / دری',
    writingLanguage: 'Dari/Persian (فارسی / دری)',
    rtl: true,
  },
  ps: {
    code: 'ps',
    label: 'پشتو',
    writingLanguage: 'Pashto (پشتو)',
    rtl: true,
  },
  pashto: {
    code: 'ps',
    label: 'پشتو',
    writingLanguage: 'Pashto (پشتو)',
    rtl: true,
  },
  en: {
    code: 'en',
    label: 'English',
    writingLanguage: 'English',
    rtl: false,
  },
  english: {
    code: 'en',
    label: 'English',
    writingLanguage: 'English',
    rtl: false,
  },
});

function normalizeLanguageKey(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
}

/**
 * Resolve project language into a stable policy object.
 * @param {string | null | undefined} raw
 */
export function resolveLanguagePolicy(raw) {
  const key = normalizeLanguageKey(raw);
  const matched = LANGUAGE_CATALOG[key] || (key.startsWith('en') ? LANGUAGE_CATALOG.en : null);
  if (matched) {
    return {
      ...matched,
      source: String(raw || matched.code),
    };
  }
  const fallbackCode = key || 'fa';
  const rtl = !fallbackCode.startsWith('en');
  return {
    code: fallbackCode,
    label: String(raw || fallbackCode),
    writingLanguage: String(raw || fallbackCode),
    rtl,
    source: String(raw || fallbackCode),
  };
}

/**
 * Locked project tone — never invent one.
 * @param {string | null | undefined} raw
 */
export function resolveTonePolicy(raw) {
  const selectedTone = String(raw || '').trim();
  return {
    selectedTone,
    locked: true,
    hasTone: Boolean(selectedTone),
  };
}

export function isRtlLanguage(raw) {
  return resolveLanguagePolicy(raw).rtl === true;
}

/**
 * Build language + tone instructions injected into LLM system prompts / input.
 */
export function buildLanguageToneDirectives({ language, tone } = {}) {
  const lang = resolveLanguagePolicy(language);
  const tonePolicy = resolveTonePolicy(tone);

  const languageInstruction = [
    `OUTPUT LANGUAGE (mandatory): Write ALL customer-facing creative text in ${lang.writingLanguage}.`,
    `Project language code: ${lang.code} (${lang.label}).`,
    'This applies to Scenario titles/story, Narration script, and Storyboard titles/visuals/actions/dialogue.',
    'Do NOT switch to another language unless the selected language itself is that language.',
    'Storyboard imagePrompt fields stay in English (image models), but every other storyboard text field must match the project language.',
  ];

  if (lang.code === 'fa') {
    languageInstruction.push(
      'Dari/Persian style: use clear everyday Afghan Dari suitable for TV/social ads.',
      'Prefer plain words over fancy literary Persian. Avoid Iranian internet slang and empty marketing clichés.',
      'Keep RTL-friendly phrasing: natural spoken order, short readable lines for on-screen and voice-over use.',
    );
  }

  const languageInstructionText = languageInstruction.join(' ');

  const toneInstruction = tonePolicy.hasTone
    ? [
        `PROJECT TONE (locked): Use exactly this tone/style: «${tonePolicy.selectedTone}».`,
        'Do NOT invent, rename, recommend, or replace the tone.',
        'Do NOT return alternative tones or a toneExplanation that claims you selected the tone.',
        'In narration JSON, set "tone" to the exact project tone string above.',
      ].join(' ')
    : [
        'No project tone was selected.',
        'Write in a clear professional marketing voice.',
        'Do NOT invent a fancy tone label — leave tone empty or "Professional".',
        'Do NOT generate tone alternatives.',
      ].join(' ');

  return {
    language: lang,
    tone: tonePolicy,
    languageInstruction: languageInstructionText,
    toneInstruction,
    combinedInstruction: `${languageInstructionText}\n${toneInstruction}`,
  };
}
