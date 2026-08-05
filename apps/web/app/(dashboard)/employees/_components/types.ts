import type { InternalRole } from "@/lib/rbac";

export const EMPLOYEE_CREATE_ROLES = [
  "SALES",
  "EDITOR",
  "NARRATOR",
  "FINANCE",
] as const;

export type EmployeeCreateRole = (typeof EMPLOYEE_CREATE_ROLES)[number];

export const STAFF_ROLES = [
  "MANAGER",
  "ADMIN",
  "SALES",
  "EDITOR",
  "NARRATOR",
  "FINANCE",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const ROLE_LABELS_FA: Record<StaffRole, string> = {
  MANAGER: "مدیر",
  ADMIN: "ادمین",
  SALES: "فروش",
  EDITOR: "ادیتور",
  NARRATOR: "نریتور",
  FINANCE: "مالی",
};

export const ROLE_BADGE_VARIANTS: Record<
  StaffRole,
  "default" | "secondary" | "success" | "warning" | "destructive" | "outline"
> = {
  MANAGER: "default",
  ADMIN: "default",
  SALES: "success",
  EDITOR: "warning",
  NARRATOR: "secondary",
  FINANCE: "outline",
};

export interface Employee {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  profileImage: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  role: {
    id: string;
    code: StaffRole | InternalRole | string;
    name: string;
  };
  teamProfile?: {
    id: string;
    kind: string;
    displayName: string;
    status: string;
  } | null;
  permissions?: string[];
}

export interface EmployeeListResponse {
  items: Employee[];
  total: number;
  page: number;
  pageSize: number;
}
