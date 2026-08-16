import {
  CUSTOMER_FACING_STATUS_LABELS,
  getCustomerFacingStatusLabel,
} from "@/lib/project-status";
import { resolveAssetSrc, storagePublicUrl } from "@/lib/api";

export const PORTAL_STATUS_LABELS = CUSTOMER_FACING_STATUS_LABELS;

export { getCustomerFacingStatusLabel };

export const CREATE_PROJECT_DENIED_MESSAGE =
  "شما بدون مجوز نمی‌توانید پروژه جدید ایجاد کنید. لطفاً با مدیر یا کارشناس فروش تماس بگیرید.";

export type PortalProjectSummary = {
  id: string;
  code: string;
  title: string;
  status: string;
  progress: import("@/lib/project-progress").ProjectProgress | number;
  createdAt: string;
  updatedAt: string;
  deadlineAt: string | null;
  budget: number | null;
  thumbnailStorageKey: string | null;
  thumbnailUrl?: string | null;
};

export type PortalDashboard = {
  stats: {
    total: number;
    active: number;
    completed: number;
    pending: number;
    underReview: number;
  };
  financial: {
    totalProjectValue: number;
    totalPaid: number;
    remainingBalance: number;
    pendingInvoices: number;
    lastPaymentDate: string | null;
  };
  canCreateProject: boolean;
  pendingBriefsCount: number;
  projects: PortalProjectSummary[];
  recentProjects: PortalProjectSummary[];
  pendingApprovals: Array<{
    id: string;
    kind: string;
    versionNumber: number;
    project: { id: string; code: string; title: string };
  }>;
  balanceSummary: {
    totalDue: number;
    totalPaid: number;
    balance: number;
  };
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    total: string;
    status: string;
    dueAt: string | null;
  }>;
};

export type PortalProjectsList = {
  items: PortalProjectSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  canCreateProject: boolean;
  pendingBriefsCount: number;
};

export function projectThumbnailUrl(
  storageKey: string | null | undefined,
  opts?: { url?: string | null; meta?: unknown },
): string | null {
  return resolveAssetSrc({
    url: opts?.url,
    storageKey,
    meta: opts?.meta,
  });
}

export function assetDownloadUrl(storageKey: string): string | null {
  return storagePublicUrl(storageKey);
}
