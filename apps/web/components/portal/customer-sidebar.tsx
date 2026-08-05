"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  PanelLeft,
} from "lucide-react";
import { toast } from "sonner";
import { logout } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import {
  PORTAL_NAV_ENTRIES,
  isPortalNavActive,
} from "@/components/portal/portal-nav-config";

type CustomerSidebarProps = {
  collapsed?: boolean;
  onNavigate?: () => void;
  mobile?: boolean;
};

export function CustomerSidebar({
  collapsed: collapsedProp,
  onNavigate,
  mobile = false,
}: CustomerSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const storeCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const collapsed = mobile ? false : (collapsedProp ?? storeCollapsed);

  async function handleLogout() {
    try {
      await logout();
      queryClient.clear();
      toast.success("خروج موفق");
      router.push("/portal/login");
    } catch {
      toast.error("خروج ناموفق بود");
    }
  }

  return (
    <aside
      dir="rtl"
      className={cn(
        "flex h-full flex-col border-e bg-sidebar text-sidebar-foreground transition-[width] duration-300",
        mobile ? "w-full border-e-0" : collapsed ? "w-[72px]" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 border-b border-sidebar-border px-3 py-4",
          collapsed && !mobile && "flex-col px-2",
        )}
      >
        <Link
          href="/portal"
          onClick={onNavigate}
          className={cn(
            "flex min-w-0 items-center gap-2.5",
            collapsed && !mobile && "justify-center",
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-accent text-sm font-bold text-white shadow-sm shadow-black/20">
            ا
          </div>
          {(!collapsed || mobile) && (
            <div className="min-w-0 text-start">
              <span className="block truncate text-base font-bold leading-tight">
                اپیکس
              </span>
              <span className="text-[11px] text-sidebar-foreground/60">
                پورتال مشتری
              </span>
            </div>
          )}
        </Link>

        {!mobile && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 shrink-0 text-sidebar-foreground/70 hover:bg-sidebar-border hover:text-sidebar-foreground",
              collapsed ? "mt-1" : "ms-auto",
            )}
            onClick={toggleSidebar}
            aria-label={collapsed ? "باز کردن منو" : "بستن منو"}
          >
            {collapsed ? (
              <ChevronsLeft className="h-4 w-4" />
            ) : (
              <ChevronsRight className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2.5">
        {PORTAL_NAV_ENTRIES.map((item) => {
          const Icon = item.icon;
          const active = isPortalNavActive(pathname, item);

          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={onNavigate}
              title={collapsed && !mobile ? item.label : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                collapsed && !mobile && "justify-center px-2",
                active
                  ? "bg-sidebar-accent text-white shadow-sm shadow-black/10"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-border hover:text-sidebar-foreground",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform duration-200",
                  !active && "group-hover:scale-105",
                )}
              />
              {(!collapsed || mobile) && (
                <span className="truncate">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-2.5">
        <Button
          variant="ghost"
          className={cn(
            "w-full gap-3 text-sidebar-foreground/75 hover:bg-sidebar-border hover:text-sidebar-foreground",
            collapsed && !mobile ? "justify-center px-2" : "justify-start",
          )}
          onClick={handleLogout}
          title="خروج"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {(!collapsed || mobile) && "خروج"}
        </Button>
      </div>
    </aside>
  );
}

export function CustomerSidebarMobileTrigger({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-9 w-9 lg:hidden"
      onClick={onClick}
      aria-label="منوی پورتال"
    >
      <PanelLeft className="h-4 w-4" />
    </Button>
  );
}
