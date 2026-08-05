import type { ComponentType } from "react";
import {
  FolderKanban,
  LayoutDashboard,
  UserRound,
} from "lucide-react";

export type PortalNavEntry = {
  key: string;
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
};

export const PORTAL_NAV_ENTRIES: PortalNavEntry[] = [
  { key: "dashboard", href: "/portal", label: "داشبورد", icon: LayoutDashboard, exact: true },
  { key: "projects", href: "/portal/projects", label: "پروژه‌های من", icon: FolderKanban },
  { key: "profile", href: "/portal/profile", label: "پروفایل", icon: UserRound },
];

export function isPortalNavActive(
  pathname: string,
  item: PortalNavEntry,
): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
