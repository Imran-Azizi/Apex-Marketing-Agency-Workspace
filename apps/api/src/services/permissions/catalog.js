/**
 * Central RBAC catalog for APEX.
 * Codes are stable identifiers used by API enforcement and the Settings UI.
 * Only modules and actions that already exist in this project are listed.
 */

export const FULL_ACCESS_ROLES = new Set(["MANAGER", "ADMIN"]);

/** Staff roles whose permissions can be customized (not Admin/Manager). */
export const MANAGEABLE_STAFF_ROLES = [
  "SALES",
  "EDITOR",
  "NARRATOR",
  "FINANCE",
  "PROJECT_MANAGER",
];

/** Roles that always retain full access and cannot be customized. */
export const LOCKED_ACCESS_ROLES = new Set(["MANAGER", "ADMIN"]);

export const PERMISSION_CATALOG = [
  {
    id: "dashboard",
    label: "داشبورد",
    description: "نمای کلی پنل و خلاصه عملکرد",
    actions: [
      {
        code: "dashboard.view",
        label: "مشاهده",
        description: "مشاهده داشبورد نقش",
      },
    ],
  },
  {
    id: "crm",
    label: "CRM و فروش",
    description: "مدیریت سرنخ‌ها، قیف فروش، مشتریان و دعوت پورتال",
    actions: [
      {
        code: "crm.view",
        label: "مشاهده",
        description: "مشاهده لیست و پرونده مشتری",
      },
      { code: "crm.create", label: "ایجاد", description: "ایجاد سرنخ و تبدیل به مشتری پس از بیعانه" },
      {
        code: "crm.edit",
        label: "ویرایش",
        description: "ویرایش اطلاعات مشتری و دارایی‌ها",
      },
      {
        code: "crm.delete",
        label: "حذف مشتری",
        description:
          "حذف نرم مشتری در CRM و فروش و مدیریت مشتریان — برای فروش به‌صورت پیش‌فرض غیرفعال است و فقط با اعطای مدیر فعال می‌شود",
      },
      {
        code: "crm.merge",
        label: "ادغام",
        description: "ادغام پرونده‌های تکراری",
      },
      {
        code: "crm.opportunity",
        label: "مدیریت قرارداد",
        description: "ویرایش فرصت، جزئیات قرارداد و پیش‌فاکتور",
      },
      {
        code: "crm.invite",
        label: "دعوت پورتال",
        description: "ارسال دعوت ورود به پورتال مشتری",
      },
      {
        code: "crm.portal_credentials",
        label: "مشاهده اطلاعات ورود پورتال",
        description:
          "مشاهده شماره واتساپ و رمز عبور پورتال مشتری در مدیریت مشتری",
      },
    ],
  },
  {
    id: "sales_assistant",
    label: "دستیار فروش",
    description: "صندوق توصیه فروش — پیگیری مشتری و فرصت‌های فروش",
    actions: [
      {
        code: "sales_assistant.view",
        label: "مشاهده",
        description: "مشاهده صندوق توصیه‌های فروش",
      },
      {
        code: "sales_assistant.act",
        label: "اقدام",
        description: "انجام، رد یا پیگیری توصیه‌های فروش",
      },
      {
        code: "sales_assistant.manage",
        label: "پیکربندی",
        description: "اجرای دستی پویش دستیار فروش",
      },
    ],
  },
  {
    id: "business_assistant",
    label: "دستیار مدیریت",
    description: "مشاور هوشمند کسب‌وکار و گفتگو با دستیار مدیریت",
    actions: [
      {
        code: "business_assistant.view",
        label: "مشاهده",
        description: "مشاهده تحلیل مشاور کسب‌وکار و گفتگو با دستیار مدیریت",
      },
      {
        code: "business_assistant.act",
        label: "اقدام",
        description: "گفتگو با دستیار مدیریت",
      },
      {
        code: "business_assistant.manage",
        label: "پیکربندی",
        description: "پاک‌کردن گفتگوی دستیار مدیریت",
      },
    ],
  },
  {
    id: "projects",
    label: "پروژه‌ها",
    description: "مشاهده و مدیریت پروژه‌های تولید",
    actions: [
      {
        code: "projects.view",
        label: "مشاهده",
        description: "مشاهده لیست و جزئیات پروژه",
      },
      {
        code: "projects.edit",
        label: "ویرایش",
        description: "ویرایش اطلاعات عملیاتی پروژه",
      },
      {
        code: "projects.create",
        label: "ایجاد",
        description: "ایجاد پروژه جدید برای مشتری موجود",
      },
      {
        code: "projects.delete",
        label: "حذف",
        description: "حذف نرم پروژه و سوابق مرتبط",
      },
      {
        code: "projects.assign",
        label: "اختصاص کارمند",
        description: "اختصاص نریتور و ادیتور به پروژه",
      },
      {
        code: "projects.complete",
        label: "تکمیل پروژه",
        description: "بازبینی اضافه و علامت‌گذاری تکمیل",
      },
    ],
  },
  {
    id: "content",
    label: "محتوا و هوش مصنوعی",
    description: "تولید سناریو، نریشن متنی و استوری‌بورد",
    actions: [
      {
        code: "content.view",
        label: "مشاهده",
        description: "مشاهده نسخه‌ها و گردش تولید محتوا",
      },
      {
        code: "content.generate",
        label: "تولید",
        description: "تولید و بازتولید محتوا با هوش مصنوعی",
      },
      {
        code: "content.edit",
        label: "ویرایش",
        description: "ویرایش نسخه محتوا",
      },
      { code: "content.delete", label: "حذف", description: "حذف نسخه محتوا" },
      {
        code: "content.approve",
        label: "تأیید داخلی",
        description: "ارسال محتوا برای تأیید مشتری",
      },
    ],
  },
  {
    id: "narration",
    label: "نریشن",
    description: "ضبط، بازبینی و تأیید صدای نریشن",
    actions: [
      {
        code: "narration.view",
        label: "مشاهده",
        description: "مشاهده وظایف و فضای کار نریشن",
      },
      {
        code: "narration.upload",
        label: "بارگذاری صدا",
        description: "شروع ضبط و ارسال فایل صوتی",
      },
      {
        code: "narration.edit",
        label: "ویرایش مهلت",
        description: "تغییر مهلت وظیفه نریشن",
      },
      {
        code: "narration.revise",
        label: "درخواست اصلاح",
        description: "بازگرداندن نریشن برای اصلاح",
      },
      {
        code: "narration.approve",
        label: "تأیید",
        description: "تأیید نریشن ضبط‌شده",
      },
    ],
  },
  {
    id: "video",
    label: "تدوین ویدیو",
    description: "ادیت، بارگذاری نسخه نهایی و بازبینی مدیر",
    actions: [
      {
        code: "video.view",
        label: "مشاهده",
        description: "مشاهده وظایف تدوین و نسخه‌های نهایی",
      },
      {
        code: "video.edit",
        label: "ویرایش",
        description: "شروع ادیت و به‌روزرسانی مهلت تدوین",
      },
      {
        code: "video.upload",
        label: "بارگذاری ویدیو نهایی",
        description: "ارسال خروجی تدوین و فایل نهایی",
      },
      {
        code: "video.approve",
        label: "تأیید",
        description: "بازبینی و تأیید ویدیو نهایی",
      },
      {
        code: "video.send",
        label: "ارسال به مشتری",
        description: "ارسال نسخه‌های نهایی برای مشتری",
      },
    ],
  },
  {
    id: "poster",
    label: "پوستر پروژه",
    description: "بارگذاری، بازبینی و ارسال پوستر نهایی پروژه",
    actions: [
      {
        code: "poster.view",
        label: "مشاهده",
        description: "مشاهده پوسترها و وضعیت بررسی",
      },
      {
        code: "poster.upload",
        label: "بارگذاری پوستر",
        description: "ارسال پوستر برای بررسی مدیریت",
      },
      {
        code: "poster.approve",
        label: "تأیید یا رد",
        description: "بازبینی پوستر و ثبت تأیید یا رد",
      },
      {
        code: "poster.send",
        label: "ارسال به مشتری",
        description: "ارسال پوستر تأییدشده به پورتال مشتری",
      },
    ],
  },
  {
    id: "finance",
    label: "مالی",
    description: "پرداخت‌ها، رسیدها و تأیید مالی",
    actions: [
      {
        code: "finance.view",
        label: "مشاهده",
        description: "مشاهده پرداخت‌ها و رسیدها",
      },
      {
        code: "finance.create",
        label: "ثبت پرداخت",
        description: "ثبت پرداخت جدید",
      },
      {
        code: "finance.edit",
        label: "ویرایش پرداخت",
        description: "ویرایش پرداخت ثبت‌شده",
      },
      {
        code: "finance.delete",
        label: "حذف مصارف شرکت",
        description:
          "حذف مصارف ثبت‌شده در مصارف شرکت — برای نقش مالی به‌صورت پیش‌فرض غیرفعال است و فقط با اعطای مدیر فعال می‌شود",
      },
      {
        code: "finance.approve",
        label: "تأیید / رد پرداخت",
        description: "تأیید یا رد پرداخت توسط مدیر",
      },
    ],
  },
  {
    id: "delivery",
    label: "تحویل",
    description: "اجازه دانلود نسخه پاک برای مشتری",
    actions: [
      {
        code: "delivery.view",
        label: "مشاهده",
        description: "مشاهده وضعیت تحویل و تاریخچه دانلود",
      },
      {
        code: "delivery.allow",
        label: "اجازه دانلود",
        description: "صدور یا لغو اجازه دانلود نسخه پاک",
      },
    ],
  },
  {
    id: "employees",
    label: "کارمندان",
    description: "ایجاد و مدیریت حساب کارکنان",
    actions: [
      {
        code: "employees.view",
        label: "مشاهده",
        description: "مشاهده فهرست و پروفایل کارمندان",
      },
      {
        code: "employees.create",
        label: "ایجاد",
        description: "ایجاد کارمند جدید",
      },
      {
        code: "employees.edit",
        label: "ویرایش",
        description: "ویرایش اطلاعات و بازنشانی رمز",
      },
      {
        code: "employees.disable",
        label: "غیرفعال‌سازی",
        description: "فعال یا غیرفعال کردن حساب",
      },
      { code: "employees.delete", label: "حذف", description: "حذف نرم کارمند" },
      {
        code: "employees.credentials",
        label: "اطلاعات ورود",
        description: "مشاهده و کپی ایمیل و رمز عبور ورود کارمند",
      },
    ],
  },
  {
    id: "backup",
    label: "بک اپ گیری",
    description: "تهیه، بازیابی و زمان‌بندی نسخه بک اپ",
    actions: [
      {
        code: "backup.view",
        label: "مشاهده",
        description: "مشاهده فهرست و وضعیت بک اپ‌ها",
      },
      {
        code: "backup.create",
        label: "ایجاد",
        description: "تهیه بک اپ دستی",
      },
      {
        code: "backup.download",
        label: "دانلود",
        description: "دانلود فایل بک اپ",
      },
      {
        code: "backup.restore",
        label: "بازیابی",
        description: "بازیابی سیستم از بک اپ",
      },
      { code: "backup.delete", label: "حذف", description: "حذف فایل بک اپ" },
      {
        code: "backup.manage",
        label: "زمان‌بندی",
        description: "ویرایش زمان‌بندی بک اپ خودکار",
      },
    ],
  },
  {
    id: "portfolio",
    label: "نمونه‌کارها",
    description: "انتشار و مدیریت نمونه‌کارهای عمومی",
    actions: [
      {
        code: "portfolio.view",
        label: "مشاهده",
        description: "مشاهده فهرست نمونه‌کارها در پنل",
      },
      {
        code: "portfolio.publish",
        label: "انتشار",
        description: "آپلود و ارسال پروژه تکمیل‌شده به نمونه‌کارها",
      },
      {
        code: "portfolio.edit",
        label: "ویرایش",
        description: "ویرایش عنوان، کتگوری، مختلط، ترتیب و وضعیت انتشار",
      },
      {
        code: "portfolio.delete",
        label: "حذف",
        description: "حذف از نمونه‌کارها بدون حذف پروژه",
      },
    ],
  },
  {
    id: "services",
    label: "خدمات",
    description: "مدیریت کارت‌های خدمات وب‌سایت عمومی",
    actions: [
      {
        code: "services.view",
        label: "مشاهده",
        description: "مشاهده فهرست خدمات در پنل",
      },
      {
        code: "services.create",
        label: "ایجاد",
        description: "ایجاد خدمت جدید",
      },
      {
        code: "services.edit",
        label: "ویرایش",
        description: "ویرایش، ترتیب و انتشار خدمات",
      },
      { code: "services.delete", label: "حذف", description: "حذف نرم خدمت" },
    ],
  },
  {
    id: "hero",
    label: "اسلایدها",
    description: "مدیریت اسلایدشو وب‌سایت عمومی",
    actions: [
      {
        code: "hero.view",
        label: "مشاهده",
        description: "مشاهده فهرست اسلایدها در پنل",
      },
      {
        code: "hero.create",
        label: "ایجاد",
        description: "ایجاد اسلاید جدید و بارگذاری تصویر",
      },
      {
        code: "hero.edit",
        label: "ویرایش",
        description: "ویرایش، ترتیب، انتشار و جایگزینی تصویر اسلاید",
      },
      { code: "hero.delete", label: "حذف", description: "حذف اسلاید" },
    ],
  },
  {
    id: "customers",
    label: "مشتریان ما",
    description: "مدیریت معرفی مشتریان وب‌سایت عمومی",
    actions: [
      {
        code: "customers.view",
        label: "مشاهده",
        description: "مشاهده فهرست مشتریان در پنل",
      },
      {
        code: "customers.create",
        label: "ایجاد",
        description: "ایجاد مشتری جدید و بارگذاری تصویر",
      },
      {
        code: "customers.edit",
        label: "ویرایش",
        description: "ویرایش، ترتیب، انتشار و جایگزینی تصویر مشتری",
      },
      { code: "customers.delete", label: "حذف", description: "حذف مشتری" },
    ],
  },
  {
    id: "contact",
    label: "پیام‌های تماس",
    description: "مدیریت پیام‌های فرم تماس وب‌سایت عمومی",
    actions: [
      {
        code: "contact.view",
        label: "مشاهده",
        description: "مشاهده صندوق پیام‌های تماس و شمارنده خوانده‌نشده",
      },
      {
        code: "contact.edit",
        label: "تغییر وضعیت",
        description: "علامت‌گذاری پیام به‌عنوان خوانده‌شده یا خوانده‌نشده",
      },
      {
        code: "contact.delete",
        label: "حذف",
        description: "حذف پیام تماس",
      },
    ],
  },
  {
    id: "settings",
    label: "تنظیمات",
    description: "پیکربندی سیستم و مدیریت دسترسی‌ها",
    actions: [
      {
        code: "settings.view",
        label: "مشاهده",
        description: "مشاهده صفحه تنظیمات",
      },
      {
        code: "settings.edit",
        label: "ویرایش",
        description: "ویرایش تنظیمات واتساپ و کاتالوگ",
      },
      {
        code: "settings.permissions",
        label: "مدیریت دسترسی‌ها",
        description: "اعطای دسترسی به کارمندان",
      },
    ],
  },
  {
    id: "audit",
    label: "گزارش فعالیت",
    description: "مشاهده سابقه تغییرات سیستم",
    actions: [
      {
        code: "audit.view",
        label: "مشاهده",
        description: "مشاهده لاگ فعالیت‌ها",
      },
    ],
  },
  {
    id: "chat",
    label: "گفتگوی داخلی",
    description: "پیام‌رسانی امن بین مدیران و کارمندان",
    actions: [
      {
        code: "chat.view",
        label: "مشاهده",
        description: "مشاهده گفتگوها و پیام‌ها",
      },
      {
        code: "chat.send",
        label: "ارسال",
        description: "ارسال، ویرایش و حذف پیام‌های خود",
      },
      {
        code: "chat.upload",
        label: "بارگذاری",
        description: "ارسال فایل و پیام صوتی",
      },
      {
        code: "chat.manage",
        label: "مدیریت دسترسی",
        description: "تنظیم گفتگوی کارمند با کارمند",
      },
    ],
  },
];

export const ALL_PERMISSION_CODES = PERMISSION_CATALOG.flatMap((mod) =>
  mod.actions.map((action) => action.code),
);

const ALL = ALL_PERMISSION_CODES;

/** Maps legacy seed/route codes to the canonical catalog. */
export const LEGACY_CODE_MAP = {
  "dashboard:view": ["dashboard.view"],
  "crm:read": ["crm.view"],
  // Write covers create/edit only — delete is a separate grantable permission.
  "crm:write": ["crm.create", "crm.edit"],
  "crm:merge": ["crm.merge"],
  "opportunity:manage": ["crm.opportunity"],
  "portal_invite:create": ["crm.invite"],
  "project:read": ["projects.view"],
  "project:write": ["projects.edit"],
  "project:start": ["projects.assign", "projects.complete"],
  "content:generate": ["content.generate", "content.edit", "content.delete"],
  "content:approve_internal": ["content.approve"],
  "narration:assign": [
    "narration.approve",
    "narration.revise",
    "narration.edit",
    "projects.assign",
  ],
  "voice:upload": ["narration.view", "narration.upload"],
  "production:upload": ["video.view", "video.edit", "poster.view"],
  "production:submit": ["video.upload", "poster.upload"],
  "finance:read": ["finance.view"],
  // Write covers create/edit only — delete is a separate grantable permission.
  "finance:write": ["finance.create", "finance.edit"],
  "download:allow": ["delivery.view", "delivery.allow"],
  "settings:manage": ["settings.view", "settings.edit", "settings.permissions"],
  "backup:manage": [
    "backup.view",
    "backup.create",
    "backup.download",
    "backup.restore",
    "backup.delete",
    "backup.manage",
  ],
  "portfolio:manage": [
    "portfolio.view",
    "portfolio.publish",
    "portfolio.edit",
    "portfolio.delete",
  ],
  "customers:manage": [
    "customers.view",
    "customers.create",
    "customers.edit",
    "customers.delete",
  ],
  "team:manage": [
    "employees.view",
    "employees.create",
    "employees.edit",
    "employees.disable",
    "employees.delete",
    "employees.credentials",
  ],
  "audit:read": ["audit.view"],
  "ai:run": ["content.generate"],
};

/**
 * Default permissions per role — equivalent to pre-RBAC access so existing
 * employees keep working after migration.
 */
export const ROLE_DEFAULT_PERMISSIONS = {
  MANAGER: ALL,
  ADMIN: ALL,
  SALES: [
    "dashboard.view",
    "crm.view",
    "crm.create",
    "crm.edit",
    // crm.delete is intentionally omitted — Sales cannot delete by default;
    // Managers grant it per-user from Settings → دسترسی‌ها.
    "crm.merge",
    "crm.opportunity",
    "crm.invite",
    "contact.view",
    "contact.edit",
    "chat.view",
    "chat.send",
    "chat.upload",
    "sales_assistant.view",
    "sales_assistant.act",
    "sales_assistant.manage",
  ],
  EDITOR: [
    "dashboard.view",
    "video.view",
    "video.edit",
    "video.upload",
    "poster.view",
    "poster.upload",
    "chat.view",
    "chat.send",
    "chat.upload",
  ],
  NARRATOR: [
    "dashboard.view",
    "narration.view",
    "narration.upload",
    "chat.view",
    "chat.send",
    "chat.upload",
  ],
  FINANCE: [
    "dashboard.view",
    "finance.view",
    "finance.create",
    "finance.edit",
    // finance.delete is intentionally omitted — Finance cannot delete company
    // expenses by default; Managers grant it per-user from Settings → دسترسی‌ها.
    "delivery.view",
    "delivery.allow",
    "audit.view",
    "chat.view",
    "chat.send",
    "chat.upload",
  ],
  PROJECT_MANAGER: [
    "dashboard.view",
    "projects.view",
    "projects.edit",
    "projects.create",
    "projects.assign",
    "projects.complete",
    "content.view",
    "poster.view",
    "chat.view",
    "chat.send",
    "chat.upload",
  ],
  CUSTOMER: ["dashboard.view", "finance.view"],
  AI_SERVICE: ["projects.view", "content.view", "content.generate"],
};

/** Legacy codes kept on roles so any leftover route checks still pass. */
export const ROLE_LEGACY_PERMISSIONS = {
  MANAGER: Object.keys(LEGACY_CODE_MAP),
  ADMIN: Object.keys(LEGACY_CODE_MAP),
  SALES: [
    "dashboard:view",
    "crm:read",
    "crm:write",
    "crm:merge",
    "opportunity:manage",
    "portal_invite:create",
    "notification:read",
  ],
  EDITOR: [
    "dashboard:view",
    "production:upload",
    "production:submit",
    "notification:read",
  ],
  NARRATOR: ["dashboard:view", "voice:upload", "notification:read"],
  FINANCE: [
    "dashboard:view",
    "finance:read",
    "finance:write",
    "download:allow",
    "audit:read",
    "notification:read",
  ],
  PROJECT_MANAGER: [
    "dashboard:view",
    "project:read",
    "project:write",
    "project:start",
    "notification:read",
  ],
  CUSTOMER: [
    "dashboard:view",
    "content:approve_client",
    "finance:read",
    "download:clean",
    "notification:read",
  ],
  AI_SERVICE: ["project:read", "ai:run"],
};

export function getRoleDefaultPermissions(roleCode) {
  return ROLE_DEFAULT_PERMISSIONS[roleCode]
    ? [...ROLE_DEFAULT_PERMISSIONS[roleCode]]
    : [];
}

export function getRoleSeedPermissions(roleCode) {
  const next = new Set([
    ...(ROLE_DEFAULT_PERMISSIONS[roleCode] || []),
    ...(ROLE_LEGACY_PERMISSIONS[roleCode] || []),
  ]);
  return [...next];
}

export function getAllSeedPermissionCodes() {
  const codes = new Set([
    ...ALL_PERMISSION_CODES,
    ...Object.keys(LEGACY_CODE_MAP),
    "content:approve_client",
    "download:clean",
    "notification:read",
    "portal:own",
  ]);
  return [...codes];
}

export function isFullAccessRole(roleCode) {
  return FULL_ACCESS_ROLES.has(roleCode);
}

export function isLockedAccessRole(roleCode) {
  return LOCKED_ACCESS_ROLES.has(roleCode);
}

export function isManageableStaffRole(roleCode) {
  return MANAGEABLE_STAFF_ROLES.includes(roleCode);
}

/**
 * Codes an actor is allowed to grant to another employee.
 * Manager and Admin are equivalent and may grant the entire catalog
 * (including settings.permissions).
 */
export function getGrantableCodes(actor) {
  if (isFullAccessRole(actor?.roleCode)) {
    return new Set(ALL_PERMISSION_CODES);
  }
  const owned = new Set(actor?.permissions || []);
  return new Set(ALL_PERMISSION_CODES.filter((code) => owned.has(code)));
}
