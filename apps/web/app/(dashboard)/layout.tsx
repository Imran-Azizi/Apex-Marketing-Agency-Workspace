"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getMe, isInternalUser, getDisplayName } from "@/lib/auth";
import { canAccessPath, getHomePath } from "@/lib/rbac";
import { resolveClientAuthPanel, setStoredAuthPanel, roleToPanel } from "@/lib/auth-panel";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { SessionKeepAlive } from "@/components/auth/session-keep-alive";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const panel = resolveClientAuthPanel(pathname);

  const { data: me, isLoading, isError, isFetching } = useQuery({
    queryKey: ["me", panel || "internal"],
    queryFn: getMe,
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (me?.role) {
      const p = roleToPanel(me.role);
      if (p) setStoredAuthPanel(p);
    }
  }, [me?.role]);

  useEffect(() => {
    // Wait for any in-flight session check; redirecting on a stale cached
    // value right after login causes a redirect loop back to /login.
    if (isLoading || isFetching) return;
    if (isError || !isInternalUser(me)) {
      router.replace("/login");
      return;
    }

    // Legacy /dashboard → role home
    if (pathname === "/dashboard" || pathname === "/dashboard/") {
      router.replace(getHomePath(me.role));
      return;
    }

    if (!canAccessPath(me.role, pathname)) {
      router.replace(getHomePath(me.role));
    }
  }, [isLoading, isFetching, isError, me, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Skeleton className="hidden h-screen w-64 rounded-none lg:block" />
        <div className="flex flex-1 flex-col">
          <Skeleton className="h-16 w-full rounded-none" />
          <div className="space-y-4 p-6">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!isInternalUser(me)) {
    return null;
  }

  if (pathname !== "/dashboard" && pathname !== "/dashboard/" && !canAccessPath(me.role, pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <EmptyState
          title="دسترسی مجاز نیست"
          description="شما اجازه مشاهده این بخش را ندارید."
          action={
            <Button asChild variant="brand">
              <Link href={getHomePath(me.role)}>بازگشت به پنل من</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <SessionKeepAlive />
      <DashboardSidebar role={me.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar
          userName={getDisplayName(me)}
          role={me.role}
          profileImage={me.profileImage}
        />
        <main className="min-w-0 flex-1 overflow-auto p-3 sm:p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
