/**
 * Deterministic mock outputs for local development without API keys.
 */

import {
  normalizeNarrationOutput,
  normalizeScenarioOutput,
  normalizeStoryboardOutput,
} from './validate.js';

export function mockOutput(agentType, input) {
  const projectId = input?.projectId || 'unknown';
  switch (agentType) {
    case 'SCENARIO': {
      const duration = input?.durationSec || 30;
      const single = {
        id: 1,
        title: 'سناریوی مشکل-راه‌حل',
        concept:
          'نمایش درد مشتری در ثانیه‌های اول و معرفی برند به‌عنوان راه‌حل سریع و قابل اعتماد',
        problem: 'برند در شلوغی بازار دیده نمی‌شود و فرصت تبدیل از دست می‌رود',
        solution: 'ویدیوی کوتاه با هوک قوی، پیام شفاف مزیت، و CTA مستقیم',
        hook: 'آیا هنوز برای دیده شدن برندتان مشکل دارید؟',
        storyFlow: 'شروع با مشکل → معرفی راه‌حل → نمایش مزیت → CTA',
        content: 'شروع با مشکل → معرفی راه‌حل → نمایش مزیت → CTA',
        sceneBreakdown: [
          { scene: 1, description: 'هوک بصری و طرح مشکل', durationSec: 5 },
          {
            scene: 2,
            description: 'نمایش راه‌حل و مزایا',
            durationSec: Math.max(10, duration - 15),
          },
          { scene: 3, description: 'CTA و بستن پیام', durationSec: 10 },
        ],
        emotionalDirection: 'انگیزش و اعتماد',
        marketingAngle: 'تمایز برند در ثانیه‌های اول',
        cta: 'همین امروز تماس بگیرید',
        totalDurationSec: duration,
      };
      return normalizeScenarioOutput(
        {
          projectId,
          ...single,
          scenarios: [single],
          recommendedScenarioId: 1,
        },
        projectId,
      );
    }
    case 'NARRATION': {
      const lang = input?.language || 'fa';
      const tone = input?.tone || 'Professional';
      const primary =
        lang === 'en'
          ? 'In a crowded market, your brand has only a few seconds to be seen. Our approach is simple, fast, and trusted—so your message lands clearly. Contact us today and start converting attention into results.'
          : 'در بازاری شلوغ، برند شما فقط چند ثانیه برای دیده شدن فرصت دارد. رویکرد ما ساده، سریع و قابل اعتماد است تا پیام‌تان شفاف برسد. همین امروز تماس بگیرید و توجه را به نتیجه تبدیل کنید.';
      return normalizeNarrationOutput(
        {
          projectId,
          script: primary,
          language: lang,
          tone,
          toneExplanation:
            lang === 'en'
              ? `Selected ${tone} tone to match brand voice, audience, and campaign goal.`
              : `لحن «${tone}» بر اساس هویت برند، مخاطب و هدف کمپین انتخاب شد.`,
          estimatedSeconds: input?.durationSec || 30,
        },
        projectId,
      );
    }
    case 'STORYBOARD':
      return normalizeStoryboardOutput(
        {
          projectId,
          scenes: [
            {
              scene_number: 1,
              title: 'Product Hook',
              duration: '5s',
              visual: 'Premium product close-up that establishes the problem hook',
              camera: 'Close-up',
              action: 'Product hero reveal',
              transition: 'Cut',
              visualDirection: 'Luxury soft light, dark charcoal backdrop, gold accents',
              imagePrompt:
                'Cinematic close-up of premium product, soft light, advertising still, consistent brand look',
            },
            {
              scene_number: 2,
              title: 'Benefit Demo',
              duration: '15s',
              visual: 'Benefit montage showing solution in action',
              camera: 'Medium',
              action: 'Lifestyle benefit demo',
              transition: 'Match cut',
              visualDirection: 'Warm lifestyle lighting, modern environment, brand product visible',
              imagePrompt:
                'Lifestyle usage scene with product, vibrant colors, commercial photography, same brand style',
            },
            {
              scene_number: 3,
              title: 'CTA End Card',
              duration: '10s',
              visual: 'End card with clear CTA and brand lockup',
              camera: 'Wide end-card',
              action: 'Logo + CTA',
              transition: 'Fade out',
              visualDirection: 'Clean end-card composition, brand colors, high contrast CTA',
              imagePrompt:
                'Brand logo end card with clear CTA, clean composition, premium advertising style',
            },
          ],
          storyboard: [
            {
              sceneNumber: 1,
              title: 'Product Hook',
              duration: '5s',
              cameraAngle: 'Close-up',
              characterActions: 'Product hero reveal',
              visualDescription:
                'Premium product close-up that establishes the problem hook',
              visualDirection: 'Luxury soft light, dark charcoal backdrop, gold accents',
              transition: 'Cut',
              shot: 1,
              imagePrompt:
                'Cinematic close-up of premium product, soft light, advertising still, consistent brand look',
            },
            {
              sceneNumber: 2,
              title: 'Benefit Demo',
              duration: '15s',
              cameraAngle: 'Medium',
              characterActions: 'Lifestyle benefit demo',
              visualDescription: 'Benefit montage showing solution in action',
              visualDirection: 'Warm lifestyle lighting, modern environment, brand product visible',
              transition: 'Match cut',
              shot: 2,
              imagePrompt:
                'Lifestyle usage scene with product, vibrant colors, commercial photography, same brand style',
            },
            {
              sceneNumber: 3,
              title: 'CTA End Card',
              duration: '10s',
              cameraAngle: 'Wide end-card',
              characterActions: 'Logo + CTA',
              visualDescription: 'End card with clear CTA and brand lockup',
              visualDirection: 'Clean end-card composition, brand colors, high contrast CTA',
              transition: 'Fade out',
              shot: 3,
              imagePrompt:
                'Brand logo end card with clear CTA, clean composition, premium advertising style',
            },
          ],
          visualStyleGuide:
            'Premium cinematic advertising stills, consistent brand product look, charcoal and gold palette',
          imagePrompts: [
            'Cinematic close-up of product, soft light, premium look, 8k, advertising still',
            'Lifestyle usage scene, vibrant colors, natural smile, commercial photography',
            'Brand logo end card with clear CTA text, clean composition, premium advertising',
          ],
          videoPrompts: [
            'Slow push-in on product hero shot, cinematic lighting, 5 seconds',
            'Cut to benefit montage, energetic pacing, lifestyle realism, 15 seconds',
            'End card with logo reveal and CTA, polished commercial finish, 10 seconds',
          ],
        },
        projectId,
      );
    default:
      return { message: 'Unsupported agent', projectId };
  }
}

export const mockService = {
  id: 'mock',
  isConfigured() {
    return true;
  },
  async completeChat({ system, userContent }) {
    // Mock never calls a network; callers use mockOutput via ai.service.
    return {
      text: JSON.stringify({
        note: 'mock',
        systemLength: String(system || '').length,
        inputKeys:
          userContent && typeof userContent === 'object'
            ? Object.keys(userContent)
            : [],
      }),
      usage: null,
      model: 'mock-apex-v5',
      provider: 'mock',
      raw: null,
    };
  },
  async completeChatWithRetry(args) {
    return this.completeChat(args);
  },
};
