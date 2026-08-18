import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  getAllSeedPermissionCodes,
  getRoleSeedPermissions,
  ROLE_DEFAULT_PERMISSIONS,
} from '../src/services/permissions/catalog.js';

/**
 * Railway public proxies can drop the first TCP attempt from local networks.
 * Retry connect before seeding instead of failing immediately.
 */
function ensureDbUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is missing');
  const url = new URL(raw);
  if (!url.searchParams.has('sslmode') && /rlwy\.net|railway/i.test(url.hostname)) {
    url.searchParams.set('sslmode', 'require');
  }
  if (!url.searchParams.has('connect_timeout')) {
    url.searchParams.set('connect_timeout', '60');
  }
  if (!url.searchParams.has('schema')) {
    url.searchParams.set('schema', 'public');
  }
  process.env.DATABASE_URL = url.toString();
  return process.env.DATABASE_URL;
}

ensureDbUrl();

const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

async function connectWithRetry(attempts = 6) {
  let lastError;
  for (let i = 1; i <= attempts; i++) {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      if (i > 1) console.log(`Database connected on attempt ${i}/${attempts}`);
      return;
    } catch (err) {
      lastError = err;
      const waitMs = Math.min(15000, 1500 * i);
      console.warn(
        `Database unreachable (attempt ${i}/${attempts}). Retrying in ${Math.round(waitMs / 1000)}s…`,
      );
      console.warn(`  → ${err?.message || err}`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastError;
}

const PERMISSIONS = getAllSeedPermissionCodes();

const ROLE_PERMS = Object.fromEntries(
  Object.keys(ROLE_DEFAULT_PERMISSIONS).map((code) => [
    code,
    getRoleSeedPermissions(code),
  ]),
);

async function main() {
  console.log('Seeding APEX Workspace...');
  await connectWithRetry();

  for (const code of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      create: { code, description: code },
      update: {},
    });
  }

  const roleIds = {};
  for (const code of Object.keys(ROLE_PERMS)) {
    const role = await prisma.role.upsert({
      where: { code },
      create: { code, name: code, description: `${code} role` },
      update: {},
    });
    roleIds[code] = role.id;
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const perms = await prisma.permission.findMany({ where: { code: { in: ROLE_PERMS[code] } } });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }

  const password = process.env.DEFAULT_MANAGER_PASSWORD || 'ApexManager!2026';
  const hash = await bcrypt.hash(password, 12);

  const manager = await prisma.user.upsert({
    where: { email: process.env.DEFAULT_MANAGER_EMAIL || 'manager@apex.af' },
    create: {
      email: process.env.DEFAULT_MANAGER_EMAIL || 'manager@apex.af',
      passwordHash: hash,
      fullName: 'مدیر اپیکس',
      roleId: roleIds.MANAGER,
    },
    update: { passwordHash: hash, roleId: roleIds.MANAGER },
  });

  const sales = await prisma.user.upsert({
    where: { email: 'sales@apex.af' },
    create: {
      email: 'sales@apex.af',
      passwordHash: await bcrypt.hash('ApexSales!2026', 12),
      fullName: 'کارشناس فروش',
      roleId: roleIds.SALES,
    },
    update: {},
  });

  const finance = await prisma.user.upsert({
    where: { email: 'finance@apex.af' },
    create: {
      email: 'finance@apex.af',
      passwordHash: await bcrypt.hash('ApexFinance!2026', 12),
      fullName: 'مالی اپیکس',
      roleId: roleIds.FINANCE,
    },
    update: {},
  });

  const editorUser = await prisma.user.upsert({
    where: { email: 'editor@apex.af' },
    create: {
      email: 'editor@apex.af',
      passwordHash: await bcrypt.hash('ApexEditor!2026', 12),
      fullName: 'ادیتور نمونه',
      roleId: roleIds.EDITOR,
    },
    update: {},
  });

  const narratorUser = await prisma.user.upsert({
    where: { email: 'narrator@apex.af' },
    create: {
      email: 'narrator@apex.af',
      passwordHash: await bcrypt.hash('ApexNarrator!2026', 12),
      fullName: 'نریتور نمونه',
      roleId: roleIds.NARRATOR,
    },
    update: {},
  });

  await prisma.teamProfile.upsert({
    where: { userId: manager.id },
    create: {
      userId: manager.id,
      kind: 'MANAGER',
      displayName: 'مدیر اپیکس',
      status: 'ACTIVE',
    },
    update: {},
  });

  const editorProfile = await prisma.teamProfile.upsert({
    where: { userId: editorUser.id },
    create: {
      userId: editorUser.id,
      kind: 'EDITOR',
      displayName: 'ادیتور اپیکس',
      status: 'ACTIVE',
    },
    update: {},
  });

  const narratorProfile = await prisma.teamProfile.upsert({
    where: { userId: narratorUser.id },
    create: {
      userId: narratorUser.id,
      kind: 'NARRATOR',
      displayName: 'صدای استودیو',
      languages: ['fa', 'ps'],
      gender: 'male',
      tone: 'confident',
      status: 'ACTIVE',
    },
    update: {},
  });

  const editorRates = await prisma.rate.count({ where: { teamProfileId: editorProfile.id } });
  if (!editorRates) {
    await prisma.rate.create({
      data: { teamProfileId: editorProfile.id, label: 'ویرایش استاندارد ۳۰ث', durationSec: 30, amount: 5000 },
    });
  }

  const narratorRates = await prisma.rate.count({ where: { teamProfileId: narratorProfile.id } });
  if (!narratorRates) {
    await prisma.rate.createMany({
      data: [
        { teamProfileId: narratorProfile.id, label: '۱۵ ثانیه', durationSec: 15, amount: 800 },
        { teamProfileId: narratorProfile.id, label: '۳۰ ثانیه', durationSec: 30, amount: 1200 },
        { teamProfileId: narratorProfile.id, label: '۶۰ ثانیه', durationSec: 60, amount: 2000 },
      ],
    });
  }

  const sampleCount = await prisma.audioSample.count({ where: { teamProfileId: narratorProfile.id } });
  if (!sampleCount) {
    await prisma.audioSample.create({
      data: {
        teamProfileId: narratorProfile.id,
        title: 'نمونه صدای فارسی',
        language: 'fa',
        gender: 'male',
        tone: 'confident',
        storageKey: 'audio/demo-narrator.mp3',
        isPublished: true,
      },
    });
  }

  await prisma.format.upsert({
    where: { ratio: '16:9' },
    create: { name: '۱۶:۹ افقی', ratio: '16:9' },
    update: { name: '۱۶:۹ افقی' },
  });
  await prisma.format.upsert({
    where: { ratio: '9:16' },
    create: { name: '۹:۱۶ عمودی', ratio: '9:16' },
    update: { name: '۹:۱۶ عمودی' },
  });
  await prisma.format.upsert({
    where: { ratio: '1:1' },
    create: { name: '۱:۱ مربعی', ratio: '1:1' },
    update: { name: '۱:۱ مربعی' },
  });
  await prisma.format.upsert({
    where: { ratio: '4:5' },
    create: { name: '۴:۵ پرتره اینستاگرام', ratio: '4:5' },
    update: { name: '۴:۵ پرتره اینستاگرام' },
  });
  await prisma.format.upsert({
    where: { ratio: '3:4' },
    create: { name: '۳:۴ پرتره', ratio: '3:4' },
    update: { name: '۳:۴ پرتره' },
  });
  await prisma.format.upsert({
    where: { ratio: '21:9' },
    create: { name: '۲۱:۹ سینمایی', ratio: '21:9' },
    update: { name: '۲۱:۹ سینمایی' },
  });

  const svc = await prisma.service.upsert({
    where: { slug: 'promo-30' },
    create: {
      name: 'ویدیوی تبلیغاتی ۳۰ ثانیه',
      slug: 'promo-30',
      description: 'ویدیوی کوتاه برای شبکه‌های اجتماعی با سناریو، نریشن و ادیت حرفه‌ای',
      startingPrice: 15000,
      durationOptions: [15, 30, 60],
      outputs: ['Scenario', 'Narration', 'Final Video'],
      revisionCount: 2,
      isPublished: true,
      sortOrder: 1,
    },
    update: {},
  });

  await prisma.service.upsert({
    where: { slug: 'promo-60' },
    create: {
      name: 'ویدیوی تبلیغاتی ۶۰ ثانیه',
      slug: 'promo-60',
      description: 'ویدیوی کامل‌تر برای یوتیوب و فیسبوک',
      startingPrice: 25000,
      durationOptions: [60],
      revisionCount: 2,
      isPublished: true,
      sortOrder: 2,
    },
    update: {},
  });

  await prisma.style.upsert({
    where: { slug: 'modern-clean' },
    create: {
      serviceId: svc.id,
      name: 'مدرن و مینیمال',
      slug: 'modern-clean',
      description: 'سبک تمیز با تایپوگرافی قوی',
      isPublished: true,
    },
    update: {},
  });

  await prisma.style.upsert({
    where: { slug: 'cinematic' },
    create: {
      serviceId: svc.id,
      name: 'سینمایی',
      slug: 'cinematic',
      description: 'فضای احساسی و تصاویر عمیق',
      isPublished: true,
    },
    update: {},
  });

  await prisma.setting.upsert({
    where: { key: 'whatsapp_number' },
    create: { key: 'whatsapp_number', value: { number: process.env.WHATSAPP_NUMBER || '93700000000' } },
    update: { value: { number: process.env.WHATSAPP_NUMBER || '93700000000' } },
  });

  await prisma.setting.upsert({
    where: { key: 'contact_email' },
    create: {
      key: 'contact_email',
      value: { email: process.env.CONTACT_EMAIL || 'info@apex.af' },
    },
    update: {},
  });

  await prisma.setting.upsert({
    where: { key: 'contact_phone' },
    create: {
      key: 'contact_phone',
      value: { number: process.env.CONTACT_PHONE || process.env.WHATSAPP_NUMBER || '93700000000' },
    },
    update: {},
  });

  await prisma.setting.upsert({
    where: { key: 'whatsapp_default_message' },
    create: {
      key: 'whatsapp_default_message',
      value: { message: 'سلام، می‌خواهم درباره خدمات ویدیویی اپیکس معلومات بگیرم.' },
    },
    update: {},
  });

  await prisma.setting.upsert({
    where: { key: 'terms_summary' },
    create: {
      key: 'terms_summary',
      value: { text: 'پس از تأیید بیعانه، فرایند تولید آغاز می‌شود. تعداد اصلاحات طبق پکیج است.' },
    },
    update: {},
  });

  await prisma.setting.upsert({
    where: { key: 'ai_settings' },
    create: {
      key: 'ai_settings',
      value: {
        provider: process.env.AI_PROVIDER || 'openai',
        defaultPromptVersion: 'v1',
        requireManagerApproval: true,
        supportedLanguages: ['fa', 'en', 'prs'],
      },
    },
    update: {},
  });

  const AI_AGENTS = [
    { code: 'SCENARIO', name: 'Scenario Agent', nameFa: 'عامل سناریو', descriptionFa: 'سناریوی تبلیغاتی و هوک', sortOrder: 1 },
    { code: 'NARRATION', name: 'Narration Agent', nameFa: 'عامل نریشن', descriptionFa: 'متن گویندگی انگلیسی و دری', sortOrder: 2 },
    { code: 'STORYBOARD', name: 'Storyboard & Prompt Agent', nameFa: 'عامل استوری‌بورد', descriptionFa: 'استوری‌بورد و پرامپت تولید', sortOrder: 3 },
  ];

  for (const agent of AI_AGENTS) {
    await prisma.aiAgent.upsert({
      where: { code: agent.code },
      create: {
        ...agent,
        description: agent.descriptionFa,
        status: 'ACTIVE',
        promptVersion: 'v4',
      },
      update: {
        name: agent.name,
        nameFa: agent.nameFa,
        descriptionFa: agent.descriptionFa,
        sortOrder: agent.sortOrder,
        status: 'ACTIVE',
        promptVersion: 'v4',
      },
    });
  }

  await prisma.$executeRawUnsafe(`
    DELETE FROM "ai_agents"
    WHERE "code"::text IN (
      'SALES_ASSISTANT', 'INTAKE', 'QC', 'PORTFOLIO', 'PROJECT_ASSISTANT'
    )
  `);

  const portfolioCategories = [
    { id: 'pcat_beverages', name: 'محصولات نوشیدنی', slug: 'beverages', sortOrder: 1 },
    { id: 'pcat_cosmetics', name: 'محصولات آرایشی و بهداشتی', slug: 'cosmetics', sortOrder: 2 },
    { id: 'pcat_services', name: 'شرکت های خدماتی', slug: 'service-companies', sortOrder: 3 },
    { id: 'pcat_transport', name: 'شرکت های ترانسپورتی', slug: 'transport', sortOrder: 4 },
    { id: 'pcat_food', name: 'محصولات خوراکی', slug: 'food', sortOrder: 5 },
    { id: 'pcat_agriculture', name: 'محصولات زراعتی', slug: 'agriculture', sortOrder: 6 },
  ];
  for (const category of portfolioCategories) {
    await prisma.portfolioCategory.upsert({
      where: { slug: category.slug },
      create: { ...category, isActive: true, isSystem: true },
      update: { name: category.name, isSystem: true },
    });
  }

  console.log('Seed complete.');
  console.log('Manager:', manager.email, '/', password);
  console.log('Sales: sales@apex.af / ApexSales!2026');
  console.log('Finance: finance@apex.af / ApexFinance!2026');
  console.log('Editor: editor@apex.af / ApexEditor!2026');
  console.log('Narrator: narrator@apex.af / ApexNarrator!2026');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
