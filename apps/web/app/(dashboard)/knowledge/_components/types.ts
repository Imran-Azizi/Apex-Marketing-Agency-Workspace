export type KnowledgeStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type KnowledgeKind = "EXPERIENCE" | "POLICY";
export type KnowledgeAttachmentKind = "IMAGE" | "VIDEO" | "DOCUMENT" | "OTHER";

export type KnowledgeUserBrief = {
  id: string;
  fullName: string;
  email?: string | null;
  profileImage?: string | null;
  roleCode?: string | null;
  roleName?: string | null;
};

export type KnowledgeStep = {
  id?: string;
  sortOrder: number;
  title: string;
  body?: string | null;
};

export type KnowledgeAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: KnowledgeAttachmentKind;
  sortOrder: number;
  url?: string | null;
  storageKey: string;
  createdAt: string;
};

export type KnowledgeEntry = {
  id: string;
  kind: KnowledgeKind;
  kindLabel: string;
  title: string;
  summary?: string | null;
  body?: string | null;
  category?: string | null;
  status: KnowledgeStatus;
  statusLabel: string;
  roleAudience: string;
  roleAudienceLabel: string;
  authorId: string;
  author: KnowledgeUserBrief | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  steps?: KnowledgeStep[];
  attachments?: KnowledgeAttachment[];
  capabilities?: {
    canEdit: boolean;
    canPublish: boolean;
    canArchive: boolean;
    canDelete: boolean;
  };
};

export type KnowledgeListResponse = {
  items: KnowledgeEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  kind?: KnowledgeKind | null;
  roleAudience?: string;
  roleAudienceLabel?: string;
  canManagePolicies?: boolean;
};

export type KnowledgeStats = {
  published: number;
  myDrafts: number;
  mine: number;
  policies: number;
};

export type KnowledgeMeta = {
  kinds: Array<{ code: KnowledgeKind; label: string }>;
  statuses: Array<{ code: KnowledgeStatus; label: string }>;
  categories: string[];
  targetRoles: Array<{ code: string; label: string }>;
  roleLabels: Record<string, string>;
};

export const STATUS_LABELS: Record<KnowledgeStatus, string> = {
  DRAFT: "پیش‌نویس",
  PUBLISHED: "منتشرشده",
  ARCHIVED: "آرشیف",
};

export const KIND_LABELS: Record<KnowledgeKind, string> = {
  EXPERIENCE: "تجربه کاری",
  POLICY: "پالیسی شرکت",
};

export const STATUS_BADGE_VARIANTS: Record<
  KnowledgeStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  DRAFT: "secondary",
  PUBLISHED: "default",
  ARCHIVED: "outline",
};
