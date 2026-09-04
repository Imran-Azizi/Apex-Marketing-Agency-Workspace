export type PortalInviteStatus =
  | "PENDING"
  | "REGISTERED"
  | "EXPIRED"
  | "REVOKED";

export interface PortalInviteRecord {
  id: string;
  crmCustomerId: string;
  opportunityId: string;
  customerCode: string | null;
  personName: string | null;
  companyName: string | null;
  whatsappNumber: string;
  status: PortalInviteStatus;
  hasPassword: boolean;
  canRevealPassword: boolean;
  registerUrl: string | null;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
}

export interface PortalInviteListResponse {
  items: PortalInviteRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PortalCredentials {
  exists: boolean;
  isRegistered: boolean;
  isActive: boolean;
  status: string;
  statusLabel: string;
  whatsappNumber: string | null;
  hasPassword: boolean;
  canRevealPassword: boolean;
  registeredAt: string | null;
  createdAt: string | null;
}

export interface PortalPasswordRevealResponse {
  customerId: string;
  whatsappNumber: string;
  password: string;
}

export const PORTAL_INVITE_STATUS_LABELS: Record<PortalInviteStatus, string> = {
  PENDING: "در انتظار ثبت‌نام",
  REGISTERED: "ثبت‌نام شده",
  EXPIRED: "منقضی",
  REVOKED: "لغو شده",
};
