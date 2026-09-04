import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPortfolioAiInput,
  mockPortfolioCopy,
  parsePortfolioAiJson,
  publicSafeBrief,
  publicSafeCustomer,
  summarizeContentVersion,
} from '../../src/modules/portfolio/copy.js';

const STORY = [
  'هدف پروژه',
  'این ویدیو برای معرفی محصول و جذب مخاطب هدف ساخته شد تا مسیر تصمیم‌گیری مشتری روشن‌تر شود.',
  'تکنیک‌های بازاریابی و فروش',
  'روایت بر ارزش محصول، پیام شفاف و دعوت به اقدام متکی است و هویت برند را تقویت می‌کند.',
  'نقاط قوت ویدیو',
  'داستان‌گویی منسجم، ارائه حرفه‌ای و تمرکز روی پیام اصلی از نقاط قوت این اثر است.',
  'جذب مخاطب',
  'شروع هدفمند و ریتم مناسب کمک می‌کند توجه مخاطب حفظ شود.',
  'اثرگذاری کسب‌وکار',
  'این ویدیو می‌تواند اعتماد برند را تقویت کند و مسیر جذب و تبدیل را پشتیبانی کند.',
].join('\n\n');

test('publicSafeBrief keeps marketing fields and drops PII', () => {
  const safe = publicSafeBrief({
    goal: 'افزایش آگاهی از برند',
    audience: 'جوانان شهری',
    email: 'secret@example.com',
    phone: '0700000000',
    personName: 'علی',
    productName: 'نوشیدنی انرژی‌زا',
    cta: 'همین حالا سفارش دهید',
  });
  assert.equal(safe.goal, 'افزایش آگاهی از برند');
  assert.equal(safe.productName, 'نوشیدنی انرژی‌زا');
  assert.equal(safe.cta, 'همین حالا سفارش دهید');
  assert.equal(safe.email, undefined);
  assert.equal(safe.phone, undefined);
  assert.equal(safe.personName, undefined);
});

test('publicSafeCustomer only exposes company/brand, not personal identity', () => {
  const customer = publicSafeCustomer(
    { personName: 'علی محمدی', companyName: 'برند نوشیدنی کابل', email: 'a@b.com' },
    { industry: 'نوشیدنی' },
  );
  assert.deepEqual(customer, {
    companyName: 'برند نوشیدنی کابل',
    industry: 'نوشیدنی',
  });
});

test('parsePortfolioAiJson accepts fenced JSON and successStory', () => {
  const parsed = parsePortfolioAiJson(
    '```json\n' +
      JSON.stringify({
        title: 'تبلیغ نوشیدنی انرژی‌زا',
        description: 'ویدیوی تبلیغاتی کوتاه با تمرکز روی طعم و انرژی محصول برای مخاطب جوان.',
        successStory: STORY,
      }) +
      '\n```',
  );
  assert.equal(parsed.title, 'تبلیغ نوشیدنی انرژی‌زا');
  assert.ok(parsed.description.length >= 20);
  assert.ok(parsed.successStory.includes('هدف پروژه'));
  assert.ok(parsed.successStory.includes('اثرگذاری کسب‌وکار'));
});

test('parsePortfolioAiJson rejects missing success story', () => {
  assert.throws(
    () =>
      parsePortfolioAiJson({
        title: 'عنوان کوتاه',
        description: 'توضیح کوتاه که بیست کاراکتر ندارد؟ نه این یکی کافی است.',
      }),
    (err) => err.code === 'invalid_portfolio_output',
  );
});

test('buildPortfolioAiInput uses project data and omits personal customer fields', () => {
  const input = buildPortfolioAiInput(
    {
      id: 'p1',
      code: 'APX-1',
      title: 'کمپین تابستانی',
      language: 'fa',
      tone: 'energetic',
      platforms: ['instagram'],
      durationSec: 30,
      brief: {
        goal: 'فروش فصلی',
        audience: 'ورزشکاران',
        email: 'hidden@x.com',
        companyName: 'فیت‌دrink',
      },
      service: { name: 'تیزر تبلیغاتی' },
      format: { name: '۹:۱۶' },
      crmCustomer: { personName: 'حسین', companyName: 'فیت‌دrink', phone: '07' },
      contentVersions: [
        {
          versionNumber: 2,
          status: 'APPROVED',
          publishedToClient: true,
          scenario: {
            title: 'انرژی در ۳۰ ثانیه',
            hook: 'خستگی تمرین',
            cta: 'امتحان کنید',
            marketingAngle: 'اثبات اجتماعی',
          },
        },
      ],
    },
    { name: 'final.mp4', kind: 'CLEAN_FINAL', videoType: 'CLEAN' },
  );

  assert.equal(input.projectTitle, 'کمپین تابستانی');
  assert.equal(input.serviceName, 'تیزر تبلیغاتی');
  assert.equal(input.brief.goal, 'فروش فصلی');
  assert.equal(input.brief.email, undefined);
  assert.equal(input.customer.companyName, 'فیت‌دrink');
  assert.equal(input.customer.personName, undefined);
  assert.equal(input.video.videoType, 'CLEAN');
  assert.equal(input.content.scenario.hook, 'خستگی تمرین');
  assert.equal(input.content.narration, undefined);
});

test('mockPortfolioCopy returns a public-safe success story without invented metrics', () => {
  const copy = mockPortfolioCopy({
    service: { name: 'ویدیوی معرفی محصول' },
    format: { name: '۱۶:۹' },
    tone: 'گرم',
    brief: { goal: 'معرفی طعم جدید', audience: 'خانواده‌ها' },
    crmCustomer: { companyName: 'نانوایی کابل' },
  });
  assert.ok(copy.title.length >= 3);
  assert.ok(copy.description.length >= 20);
  assert.ok(copy.successStory.includes('هدف پروژه'));
  assert.ok(copy.successStory.includes('تکنیک‌های بازاریابی'));
  assert.ok(copy.successStory.includes('نقاط قوت ویدیو'));
  assert.ok(copy.successStory.includes('جذب مخاطب'));
  assert.ok(copy.successStory.includes('اثرگذاری کسب‌وکار'));
  assert.equal(/[۰-۹0-9]+\s*%/.test(copy.successStory), false);
  assert.ok(copy.successStory.includes('نانوایی کابل'));
});

test('summarizeContentVersion keeps scenario marketing fields only', () => {
  const summary = summarizeContentVersion({
    versionNumber: 3,
    status: 'APPROVED',
    publishedToClient: true,
    scenario: {
      title: 'روایت برند',
      marketingAngle: 'اعتمادسازی',
      sceneBreakdown: [{ scene: 1, description: 'نمای محصول روی میز چوبی' }],
    },
    narration: { script: 'طعمی که روزتان را می‌سازد.' },
  });
  assert.equal(summary.scenario.marketingAngle, 'اعتمادسازی');
  assert.equal(summary.narration.script.includes('طعمی'), true);
  assert.equal(summary.storyboard, undefined);
});
