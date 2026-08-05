import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Settings,
  Clapperboard,
  UserCog,
  MessageSquare,
  Mic2,
} from "lucide-react";

export type InternalRole =
  | "MANAGER"
  | "ADMIN"
  | "SALES"
  | "FINANCE"
  | "EDITOR"
  | "NARRATOR";

export const INTERNAL_ROLES: InternalRole[] = [
  "MANAGER",
  "ADMIN",
  "SALES",
  "FINANCE",
  "EDITOR",
  "NARRATOR",
];

export const ROLE_LABELS: Record<InternalRole, string> = {
  MANAGER: "مدیر",
  ADMIN: "ادمین",
  SALES: "فروش",
  FINANCE: "مالی",
  EDITOR: "ادیتور",
  NARRATOR: "نریتور",
};

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Post-login home for each role (Spec §3 + dedicated panels). */
export const ROLE_HOME: Record<InternalRole, string> = {
  MANAGER: "/manager/dashboard",
  ADMIN: "/manager/dashboard",
  SALES: "/sales/dashboard",
  /** Finance module removed — payment ops live in CRM / project detail. */
  FINANCE: "/crm",
  EDITOR: "/editor/dashboard",
  NARRATOR: "/narrator/dashboard",
};

const MANAGER_NAV: NavItem[] = [
  {
    href: "/manager/dashboard",
    label: "داشبورد مدیریت",
    icon: LayoutDashboard,
  },
  { href: "/crm", label: "مدیریت مشتریان", icon: Users },
  { href: "/projects", label: "پروژه‌ها", icon: FolderKanban },
  { href: "/employees", label: "مدیریت کارمندان", icon: UserCog },
  { href: "/settings", label: "تنظیمات", icon: Settings },
];

/**
 * Sidebar items per role.
 * Paths not listed here are still guarded by ROUTE_ACCESS if visited manually.
 */
export const ROLE_NAV: Record<InternalRole, NavItem[]> = {
  MANAGER: MANAGER_NAV,
  ADMIN: MANAGER_NAV,
  SALES: [
    { href: "/sales/dashboard", label: "داشبورد فروش", icon: LayoutDashboard },
    { href: "/crm", label: "سرنخ و مشتری", icon: Users },
    { href: "/projects", label: "پروژه‌ها (مشاهده)", icon: FolderKanban },
    {
      href: "/sales/interactions",
      label: "تعاملات مشتری",
      icon: MessageSquare,
    },
  ],
  FINANCE: [
    { href: "/crm", label: "CRM و پرداخت‌ها", icon: Users },
    { href: "/projects", label: "پروژه‌ها", icon: FolderKanban },
  ],
  EDITOR: [
    {
      href: "/editor/dashboard",
      label: "داشبورد",
      icon: LayoutDashboard,
    },
    { href: "/editor/projects", label: "همه پروژه ها", icon: Clapperboard },
  ],
  NARRATOR: [
    {
      href: "/narrator/dashboard",
      label: "داشبورد",
      icon: LayoutDashboard,
    },
    { href: "/narrator/projects", label: "همه پروژه‌های", icon: Mic2 },
  ],
};

/**
 * Prefix-based route ACL. First match wins (more specific first).
 * MANAGER/ADMIN can access everything listed for any role via wildcard.
 */
const ROUTE_RULES: Array<{ prefix: string; roles: InternalRole[] }> = [
  { prefix: "/manager", roles: ["MANAGER", "ADMIN"] },
  { prefix: "/employees", roles: ["MANAGER", "ADMIN"] },
  { prefix: "/sales", roles: ["MANAGER", "ADMIN", "SALES"] },
  { prefix: "/editor", roles: ["MANAGER", "ADMIN", "EDITOR"] },
  { prefix: "/narrator", roles: ["MANAGER", "ADMIN", "NARRATOR"] },
  { prefix: "/crm", roles: ["MANAGER", "ADMIN", "SALES", "FINANCE"] },
  { prefix: "/settings", roles: ["MANAGER", "ADMIN"] },
  { prefix: "/projects", roles: ["MANAGER", "ADMIN", "SALES", "FINANCE"] },
  {
    prefix: "/dashboard",
    roles: ["MANAGER", "ADMIN", "SALES", "FINANCE", "EDITOR", "NARRATOR"],
  },
];

export function isInternalRole(
  role: string | null | undefined,
): role is InternalRole {
  return !!role && INTERNAL_ROLES.includes(role as InternalRole);
}

export function isFullAccessRole(role: string | null | undefined): boolean {
  return role === "MANAGER" || role === "ADMIN";
}

export function getHomePath(role: string | null | undefined): string {
  if (isInternalRole(role)) return ROLE_HOME[role];
  return "/login";
}

export function getNavItems(role: string | null | undefined): NavItem[] {
  if (isInternalRole(role)) return ROLE_NAV[role];
  return [];
}

export function canAccessPath(
  role: string | null | undefined,
  pathname: string,
): boolean {
  if (!isInternalRole(role)) return false;
  if (isFullAccessRole(role)) {
    return (
      pathname.startsWith("/manager") ||
      pathname.startsWith("/employees") ||
      pathname.startsWith("/sales") ||
      pathname.startsWith("/editor") ||
      pathname.startsWith("/narrator") ||
      pathname.startsWith("/crm") ||
      pathname.startsWith("/projects") ||
      pathname.startsWith("/settings") ||
      pathname === "/dashboard" ||
      pathname.startsWith("/dashboard/")
    );
  }

  const rule = ROUTE_RULES.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
  );
  if (!rule) {
    return false;
  }
  return rule.roles.includes(role);
}

export function getRoleLabel(role: string | null | undefined): string {
  if (isInternalRole(role)) return ROLE_LABELS[role];
  return role || "";
}
