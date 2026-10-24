export const KNOWLEDGE_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
export const KNOWLEDGE_KINDS = ['EXPERIENCE', 'POLICY'];

export const KNOWLEDGE_STATUS_LABELS = {
  DRAFT: 'پیش‌نویس',
  PUBLISHED: 'منتشرشده',
  ARCHIVED: 'آرشیف',
};

export const KNOWLEDGE_KIND_LABELS = {
  EXPERIENCE: 'تجربه کاری',
  POLICY: 'پالیسی شرکت',
};

export const KNOWLEDGE_ROLE_LABELS = {
  MANAGER: 'مدیر',
  ADMIN: 'ادمین',
  SALES: 'فروش',
  EDITOR: 'ادیتور',
  NARRATOR: 'نریتور',
  FINANCE: 'مالی',
  PROJECT_MANAGER: 'مدیر پروژه',
};

export const KNOWLEDGE_TARGET_ROLES = [
  'MANAGER',
  'ADMIN',
  'SALES',
  'EDITOR',
  'NARRATOR',
  'FINANCE',
  'PROJECT_MANAGER',
];

export const KNOWLEDGE_CATEGORIES = [
  'گردش‌کار',
  'تکنیک',
  'بهترین‌روش',
  'آموزش',
  'عیب‌یابی',
  'استاندارد',
  'ایمنی',
  'سایر',
];

export const KNOWLEDGE_ATTACHMENT_MAX_BYTES = 100 * 1024 * 1024;

export const KNOWLEDGE_ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const KNOWLEDGE_ALLOWED_VIDEO_MIMES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

export const KNOWLEDGE_ALLOWED_DOC_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
]);
