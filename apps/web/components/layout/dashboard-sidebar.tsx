"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth";
import { getNavItems, getRoleLabel, type InternalRole } from "@/lib/rbac";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface DashboardSidebarProps {
  role?: string | null;
}

export function DashboardSidebar({ role }: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const navItems = getNavItems(role);

  async function handleLogout() {
    try {
      await logout();
      // Drop all cached data from the previous session so nothing leaks
      // to the login screen or a different account.
      queryClient.clear();
      toast.success("خروج موفق");
      router.push("/login");
    } catch {
      toast.error("خروج ناموفق بود");
    }
  }

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-e bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-accent text-sm font-bold text-white">
          ا
        </div>
        <div className="min-w-0">
          <span className="block text-lg font-bold leading-tight">اپیکس</span>
          {role && (
            <span className="text-xs text-sidebar-foreground/70">
              {getRoleLabel(role)}
            </span>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const hasMoreSpecific = navItems.some(
            (other) =>
              other.href !== item.href &&
              other.href.startsWith(`${item.href}/`) &&
              (pathname === other.href || pathname.startsWith(`${other.href}/`))
          );
          const active =
            !hasMoreSpecific &&
            (pathname === item.href || pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-white"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-border hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4 space-y-2">
        {role && (
          <Badge variant="secondary" className="w-full justify-center">
            {role as InternalRole}
          </Badge>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground/80 hover:bg-sidebar-border hover:text-sidebar-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          خروج
        </Button>
      </div>
    </aside>
  );
}
