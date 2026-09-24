import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Settings,
  Clapperboard,
  UserCog,
  Mic2,
  HardDrive,
  Images,
  BriefcaseBusiness,
  Globe,
  Inbox,
  Presentation,
  Handshake,
  LayoutTemplate,
  Kanban,
  Wallet,
  Receipt,
  Banknote,
  TrendingUp,
  Bot,
  Film,
} from "lucide-react";

export type InternalRole =
  | "MANAGER"
  | "ADMIN"
  | "SALES"
  | "FINANCE"
  | "EDITOR"
  | "NARRATOR"
  | "PROJECT_MANAGER";

export const INTERNAL_ROLES: InternalRole[] = [
  "MANAGER",
  "ADMIN",
  "SALES",
  "FINANCE",
  "EDITOR",
  "NARRATOR",
  "PROJECT_MANAGER",
];

export const ROLE_LABELS: Record<InternalRole, string> = {
  MANAGER: "مدیر",
  ADMIN: "ادمین",
  SALES: "فروش",
  FINANCE: "مالی",
  EDITOR: "ادیتور",
  NARRATOR: "نریتور",
  PROJECT_MANAGER: "مدیر پروژه",
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
  SALES: "/crm-sales",
  FINANCE: "/finance",
  EDITOR: "/editor/dashboard",
  NARRATOR: "/narrator/dashboard",
  PROJECT_MANAGER: "/project-manager/dashboard",
};

const MANAGER_NAV: NavItem[] = [
  {
    href: "/manager/dashboard",
    label: "داشبورد مدیریت",
    icon: LayoutDashboard,
  },
  { href: "/finance", label: "مالی", icon: Wallet },
  { href: "/crm-sales", label: "CRM و فروش", icon: Kanban },
  { href: "/crm", label: "مدیریت مشتریان", icon: Users },
  { href: "/projects", label: "پروژه‌ها", icon: FolderKanban },
  { href: "/manager/video-storage", label: "مدیریت ویدیوها", icon: Film },
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
      {
        href: "/manager/hero",
        label: "مدیریت اسلایدهای",
        icon: Presentation,
      },
      {
        href: "/manager/landing-pages",
        label: "صفحات لندنگ",
        icon: LayoutTemplate,
      },
      {
        href: "/manager/customers",
        label: "مشتریان ما",
        icon: Handshake,
      },
      { href: "/manager/messages", label: "پیام‌های تماس", icon: Inbox },
    ],
  },
  { href: "/employees", label: "مدیریت کارمندان", icon: UserCog },
  { href: "/backup", label: "بک اپ گیری", icon: HardDrive },
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
    { href: "/crm-sales", label: "CRM و فروش", icon: Kanban },
    { href: "/crm", label: "مدیریت مشتریان", icon: Users },
    { href: "/sales/messages", label: "پیام‌های تماس", icon: Inbox },
  ],
  FINANCE: [
    { href: "/finance", label: "داشبورد مالی", icon: Wallet },
    { href: "/finance/projects", label: "پروژه‌ها (نمای مالی)", icon: FolderKanban },
    { href: "/finance/expenses", label: "مصارف شرکت", icon: Receipt },
    { href: "/finance/salaries", label: "معاشات کارمندان", icon: Banknote },
    { href: "/finance/pnl", label: "سود و زیان", icon: TrendingUp },
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
  PROJECT_MANAGER: [
    {
      href: "/project-manager/dashboard",
      label: "داشبورد",
      icon: LayoutDashboard,
    },
    { href: "/projects", label: "پروژه‌ها", icon: FolderKanban },
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

/**
 * Reassigning the project editor is a manager action.
 * The EDITOR role must never see or invoke this, even if projects.assign was granted.
 */
export function canAssignProjectEditor(
  permissions: string[] | null | undefined,
  role?: string | null,
): boolean {
  if (role === "EDITOR") return false;
  return hasPermission(permissions, "projects.assign", role);
}

/** Poster approve/reject is exclusive to Manager (and Admin). Editors never get these actions. */
export function canReviewProjectPosters(
  permissions: string[] | null | undefined,
  role?: string | null,
): boolean {
  if (role === "EDITOR") return false;
  if (!isFullAccessRole(role)) return false;
  return hasPermission(permissions, "poster.approve", role);
}

/** Sending an approved poster to the customer is exclusive to Manager (and Admin). */
export function canSendProjectPosters(
  permissions: string[] | null | undefined,
  role?: string | null,
): boolean {
  if (role === "EDITOR") return false;
  if (!isFullAccessRole(role)) return false;
  return hasPermission(permissions, "poster.send", role);
}

/** Final-video approve/revision is exclusive to Manager (and Admin). Editors never get these actions. */
export function canReviewFinalVideos(
  permissions: string[] | null | undefined,
  role?: string | null,
): boolean {
  if (role === "EDITOR") return false;
  if (!isFullAccessRole(role)) return false;
  return hasPermission(permissions, "video.approve", role);
}

/** Sending approved final videos to the customer is exclusive to Manager (and Admin). */
export function canSendFinalVideos(
  permissions: string[] | null | undefined,
  role?: string | null,
): boolean {
  if (role === "EDITOR") return false;
  if (!isFullAccessRole(role)) return false;
  return hasPermission(permissions, "video.send", role);
}

/** Portal invite tab / send — Sales, Manager, and Admin with crm.invite. */
export function canManagePortalInvite(
  permissions?: string[] | null,
  role?: string | null,
): boolean {
  return hasPermission(permissions, "crm.invite", role);
}

/** Portal WhatsApp + password on customer details are exclusive to Manager (and Admin). */
export function canViewPortalCredentials(
  permissions?: string[] | null,
  role?: string | null,
): boolean {
  if (!isFullAccessRole(role)) return false;
  return hasPermission(permissions, "crm.portal_credentials", role);
}

export function getHomePath(role: string | null | undefined): string {
  if (isInternalRole(role)) return ROLE_HOME[role];
  return "/login";
}

const ROUTE_PERMISSIONS: Array<{ prefix: string; permission: string }> = [
  { prefix: "/business-assistant", permission: "business_assistant.view" },
  { prefix: "/sales-assistant", permission: "sales_assistant.view" },
  { prefix: "/sales/messages", permission: "contact.view" },
  { prefix: "/manager/messages", permission: "contact.view" },
  { prefix: "/manager/customers", permission: "customers.view" },
  { prefix: "/manager/portfolio", permission: "portfolio.view" },
  { prefix: "/manager/video-storage", permission: "video_storage.view" },
  { prefix: "/manager/hero", permission: "hero.view" },
  { prefix: "/manager/landing-pages", permission: "landing_pages.view" },
  { prefix: "/manager", permission: "dashboard.view" },
  { prefix: "/sales", permission: "dashboard.view" },
  { prefix: "/editor", permission: "video.view" },
  { prefix: "/narrator", permission: "narration.view" },
  { prefix: "/project-manager", permission: "dashboard.view" },
  { prefix: "/employees", permission: "employees.view" },
  { prefix: "/catalog/services", permission: "services.view" },
  { prefix: "/backup", permission: "backup.view" },
  { prefix: "/settings", permission: "settings.view" },
  { prefix: "/crm-sales", permission: "crm.view" },
  { prefix: "/crm", permission: "crm.view" },
  { prefix: "/finance/projects", permission: "finance.view" },
  { prefix: "/finance", permission: "finance.view" },
  { prefix: "/projects", permission: "projects.view" },
  { prefix: "/dashboard", permission: "dashboard.view" },
];

const EXTRA_NAV: Array<NavItem & { permission: string }> = [
  {
    href: "/finance",
    label: "مالی",
    icon: Wallet,
    permission: "finance.view",
  },
  {
    href: "/crm-sales",
    label: "CRM و فروش",
    icon: Kanban,
    permission: "crm.view",
  },
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
    href: "/manager/video-storage",
    label: "مدیریت ویدیوها",
    icon: Film,
    permission: "video_storage.view",
  },
  {
    href: "/manager/hero",
    label: "مدیریت اسلایدهای",
    icon: Presentation,
    permission: "hero.view",
  },
  {
    href: "/manager/landing-pages",
    label: "صفحات لندنگ",
    icon: LayoutTemplate,
    permission: "landing_pages.view",
  },
  {
    href: "/manager/customers",
    label: "مشتریان ما",
    icon: Handshake,
    permission: "customers.view",
  },
  {
    href: "/manager/messages",
    label: "پیام‌های تماس",
    icon: Inbox,
    permission: "contact.view",
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
    label: "بک اپ گیری",
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

const FINANCE_EXTRA_NAV_BLOCKLIST = new Set([
  "/crm",
  "/crm-sales",
  "/projects",
]);

const SALES_EXTRA_NAV_BLOCKLIST = new Set([
  "/finance",
  "/projects",
  "/manager/messages",
]);

const ASSISTANT_NAV_CHILDREN: Array<NavItem & { permission: string }> = [
  {
    href: "/business-assistant",
    label: "دستیار مدیریت",
    icon: BriefcaseBusiness,
    permission: "business_assistant.view",
  },
  {
    href: "/sales-assistant",
    label: "دستیار فروش",
    icon: Bot,
    permission: "sales_assistant.view",
  },
];

const ASSISTANT_PATHS = new Set(
  ASSISTANT_NAV_CHILDREN.map((item) => item.href),
);

function buildAssistantsNavGroup(
  role: InternalRole,
  permissions?: string[] | null,
): NavItem | null {
  const children = ASSISTANT_NAV_CHILDREN.filter((child) =>
    hasPermission(permissions, child.permission, role),
  ).map(({ permission: _permission, ...item }) => item);

  if (!children.length) return null;

  return {
    href: "group:assistants",
    label: "دستیارها",
    icon: Bot,
    children,
  };
}

function stripAssistantEntries(items: NavItem[]): NavItem[] {
  return items.filter(
    (item) =>
      item.href !== "group:assistants" && !ASSISTANT_PATHS.has(item.href),
  );
}

function insertAssistantsGroup(
  items: NavItem[],
  group: NavItem,
  role: InternalRole,
): NavItem[] {
  const next = stripAssistantEntries(items);

  if (role === "SALES") {
    return [group, ...next];
  }

  const financeIdx = next.findIndex((item) => item.href === "/finance");
  if (financeIdx >= 0) {
    const out = [...next];
    out.splice(financeIdx + 1, 0, group);
    return out;
  }

  const dashboardIdx = next.findIndex((item) => item.href.includes("/dashboard"));
  if (dashboardIdx >= 0) {
    const out = [...next];
    out.splice(dashboardIdx + 1, 0, group);
    return out;
  }

  return [group, ...next];
}

export function contactMessagesPath(role: string | null | undefined): string {
  return role === "SALES" ? "/sales/messages" : "/manager/messages";
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
    if (role === "FINANCE" && FINANCE_EXTRA_NAV_BLOCKLIST.has(extra.href)) {
      continue;
    }
    if (role === "SALES" && SALES_EXTRA_NAV_BLOCKLIST.has(extra.href)) {
      continue;
    }
    if (!hasPermission(permissions, extra.permission, role)) continue;
    filtered.push({
      href: extra.href,
      label: extra.label,
      icon: extra.icon,
    });
    seen.add(extra.href);
  }

  const assistantsGroup = buildAssistantsNavGroup(role, permissions);
  if (assistantsGroup) {
    return insertAssistantsGroup(filtered, assistantsGroup, role);
  }

  return stripAssistantEntries(filtered);
}

export function canAccessPath(
  role: string | null | undefined,
  pathname: string,
  permissions?: string[] | null,
): boolean {
  if (!isInternalRole(role)) return false;

  if (role === "FINANCE") {
    for (const blocked of FINANCE_EXTRA_NAV_BLOCKLIST) {
      if (pathname === blocked || pathname.startsWith(`${blocked}/`)) {
        return false;
      }
    }
  }

  if (role === "SALES") {
    for (const blocked of SALES_EXTRA_NAV_BLOCKLIST) {
      if (pathname === blocked || pathname.startsWith(`${blocked}/`)) {
        return false;
      }
    }
  }

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
