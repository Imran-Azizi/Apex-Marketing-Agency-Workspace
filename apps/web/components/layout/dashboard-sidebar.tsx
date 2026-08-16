"use client";

import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth";
import { getNavItems, getRoleLabel, type InternalRole } from "@/lib/rbac";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/brand/logo";
import { DashboardNav } from "@/components/layout/dashboard-nav";

interface DashboardSidebarProps {
  role?: string | null;
  permissions?: string[] | null;
}

export function DashboardSidebar({ role, permissions }: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const navItems = getNavItems(role, permissions);

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
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <Logo
          size="md"
          onDark
          subtitle={role ? getRoleLabel(role) : undefined}
          className="text-sidebar-foreground"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        <DashboardNav items={navItems} pathname={pathname} />
      </div>

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
