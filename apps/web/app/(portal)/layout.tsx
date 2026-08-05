"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getMe, isPortalUser, getDisplayName } from "@/lib/auth";
import { setStoredAuthPanel } from "@/lib/auth-panel";
import { useUiStore } from "@/stores/ui-store";
import {
  CustomerSidebar,
  CustomerSidebarMobileTrigger,
} from "@/components/portal/customer-sidebar";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SessionKeepAlive } from "@/components/auth/session-keep-alive";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setStoredAuthPanel("portal");
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const {
    data: me,
    isLoading,
    isError,
    isFetching,
  } = useQuery({
    queryKey: ["me", "portal"],
    queryFn: getMe,
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (isLoading || isFetching) return;
    if (isError || !isPortalUser(me)) {
      router.replace("/portal/login");
    }
  }, [isLoading, isFetching, isError, me, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <Skeleton className="hidden h-screen w-64 lg:block" />
        <div className="flex flex-1 flex-col">
          <Skeleton className="h-14 w-full" />
          <div className="space-y-4 p-4">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!isPortalUser(me)) {
    return null;
  }

  const displayName = getDisplayName(me) || "مشتری";

  return (
    <div className="flex min-h-screen bg-background">
      <SessionKeepAlive />

      <div className="sticky top-0 z-30 hidden h-screen shrink-0 lg:flex">
        <CustomerSidebar collapsed={collapsed} />
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="right"
          className="w-[min(100%,20rem)] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>منوی پورتال مشتری</SheetTitle>
          </SheetHeader>
          <CustomerSidebar
            mobile
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <div className="flex h-14 items-center justify-between gap-3 px-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <CustomerSidebarMobileTrigger
                onClick={() => setMobileOpen(true)}
              />
              <div className="min-w-0 text-start lg:hidden">
                <p className="truncate text-sm font-semibold">اپیکس</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {displayName}
                </p>
              </div>
              <p className="hidden truncate text-sm text-muted-foreground lg:block">
                پورتال مشتری
              </p>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <ThemeToggle />
              <NotificationCenter />
            </div>
          </div>
        </header>

        <main
          className={cn("mx-auto w-full flex-1 p-3 sm:p-5 lg:p-6", "max-w-7xl")}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
