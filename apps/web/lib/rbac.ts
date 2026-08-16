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
  HardDrive,
  Images,
  BriefcaseBusiness,
  Globe,
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
  children?: NavItem[];
}

export function isNavGroup(
  item: NavItem,
): item is NavItem & { children: NavItem[] } {
  return Array.isArray(item.children) && item.children.length > 0;
}

export function flattenNavLinks(items: NavItem[]): NavItem[] {
  return items.flatMap((item) => (isNavGroup(item) ? item.children : [item]));
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
  {
    href: "group:public-website",
    label: "مدیریت وبسایت عمومی",
    icon: Globe,
    children: [
      { href: "/manager/portfolio", label: "نمونه‌کارها", icon: Images },
      {
        href: "/catalog/services",
        label: "مدیریت خدمات",
        icon: BriefcaseBusiness,
      },
    ],
  },
  { href: "/employees", label: "مدیریت کارمندان", icon: UserCog },
  { href: "/backup", label: "پشتیبان‌گیری", icon: HardDrive },
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

export function isInternalRole(
  role: string | null | undefined,
): role is InternalRole {
  return !!role && INTERNAL_ROLES.includes(role as InternalRole);
}

export function isFullAccessRole(role: string | null | undefined): boolean {
  return role === "MANAGER" || role === "ADMIN";
}

export function hasPermission(
  permissions: string[] | null | undefined,
  code: string | string[],
  role?: string | null,
): boolean {
  if (isFullAccessRole(role)) return true;
  const needed = Array.isArray(code) ? code : [code];
  if (!needed.length) return true;
  const set = new Set(permissions || []);
  return needed.some((item) => set.has(item));
}

export function getHomePath(role: string | null | undefined): string {
  if (isInternalRole(role)) return ROLE_HOME[role];
  return "/login";
}

const ROUTE_PERMISSIONS: Array<{ prefix: string; permission: string }> = [
  { prefix: "/sales/interactions", permission: "crm.view" },
  { prefix: "/manager/portfolio", permission: "portfolio.view" },
  { prefix: "/manager", permission: "dashboard.view" },
  { prefix: "/sales", permission: "dashboard.view" },
  { prefix: "/editor", permission: "video.view" },
  { prefix: "/narrator", permission: "narration.view" },
  { prefix: "/employees", permission: "employees.view" },
  { prefix: "/catalog/services", permission: "services.view" },
  { prefix: "/backup", permission: "backup.view" },
  { prefix: "/settings", permission: "settings.view" },
  { prefix: "/crm", permission: "crm.view" },
  { prefix: "/projects", permission: "projects.view" },
  { prefix: "/dashboard", permission: "dashboard.view" },
];

const EXTRA_NAV: Array<NavItem & { permission: string }> = [
  {
    href: "/crm",
    label: "مدیریت مشتریان",
    icon: Users,
    permission: "crm.view",
  },
  {
    href: "/projects",
    label: "پروژه‌ها",
    icon: FolderKanban,
    permission: "projects.view",
  },
  {
    href: "/manager/portfolio",
    label: "نمونه‌کارها",
    icon: Images,
    permission: "portfolio.view",
  },
  {
    href: "/employees",
    label: "مدیریت کارمندان",
    icon: UserCog,
    permission: "employees.view",
  },
  {
    href: "/catalog/services",
    label: "مدیریت خدمات",
    icon: BriefcaseBusiness,
    permission: "services.view",
  },
  {
    href: "/backup",
    label: "پشتیبان‌گیری",
    icon: HardDrive,
    permission: "backup.view",
  },
  {
    href: "/settings",
    label: "تنظیمات",
    icon: Settings,
    permission: "settings.view",
  },
];

function requiredPermissionForPath(pathname: string): string | null {
  const rule = ROUTE_PERMISSIONS.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
  );
  return rule?.permission ?? null;
}

function filterNavItem(
  item: NavItem,
  role: InternalRole,
  permissions?: string[] | null,
): NavItem | null {
  if (isNavGroup(item)) {
    const children = item.children.filter((child) =>
      canAccessPath(role, child.href, permissions),
    );
    if (!children.length) return null;
    return { ...item, children };
  }
  return canAccessPath(role, item.href, permissions) ? item : null;
}

export function getNavItems(
  role: string | null | undefined,
  permissions?: string[] | null,
): NavItem[] {
  if (!isInternalRole(role)) return [];
  const base = ROLE_NAV[role] || [];
  const filtered: NavItem[] = [];
  for (const item of base) {
    const next = filterNavItem(item, role, permissions);
    if (next) filtered.push(next);
  }
  const seen = new Set(flattenNavLinks(filtered).map((item) => item.href));
  for (const extra of EXTRA_NAV) {
    if (seen.has(extra.href)) continue;
    if (!hasPermission(permissions, extra.permission, role)) continue;
    filtered.push({
      href: extra.href,
      label: extra.label,
      icon: extra.icon,
    });
    seen.add(extra.href);
  }
  return filtered;
}

export function canAccessPath(
  role: string | null | undefined,
  pathname: string,
  permissions?: string[] | null,
): boolean {
  if (!isInternalRole(role)) return false;

  const required = requiredPermissionForPath(pathname);
  if (!required) return false;

  if (
    isFullAccessRole(role) &&
    (permissions == null || permissions.length === 0)
  ) {
    return true;
  }

  return hasPermission(permissions, required, role);
}

export function getRoleLabel(role: string | null | undefined): string {
  if (isInternalRole(role)) return ROLE_LABELS[role];
  return role || "";
}
