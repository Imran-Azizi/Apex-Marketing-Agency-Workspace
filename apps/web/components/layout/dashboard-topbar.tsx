"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getNavItems, getRoleLabel } from "@/lib/rbac";
import { filePreviewUrl } from "@/lib/upload";
import { Badge } from "@/components/ui/badge";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { MessageInboxButton } from "@/components/contact/message-inbox-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Logo } from "@/components/brand/logo";
import { DashboardNav } from "@/components/layout/dashboard-nav";

interface DashboardTopbarProps {
  userName?: string;
  role?: string | null;
  profileImage?: string | null;
  permissions?: string[] | null;
}

export function DashboardTopbar({
  userName,
  role,
  profileImage,
  permissions,
}: DashboardTopbarProps) {
  const pathname = usePathname();
  const navItems = getNavItems(role, permissions);
  const initials = userName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
  const imageUrl = profileImage ? filePreviewUrl(profileImage) : null;
  const [imageFailed, setImageFailed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  // Close the mobile drawer after route changes (covers nested/dynamic links).
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function closeMobileNav() {
    setMobileOpen(false);
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 lg:px-6">
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="flex w-[min(100%,16rem)] flex-col gap-0 overflow-hidden bg-sidebar p-0 text-sidebar-foreground sm:max-w-none"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>منوی ناوبری</SheetTitle>
          </SheetHeader>

          <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-4 pe-12">
            <Logo
              size="md"
              onDark
              subtitle={role ? getRoleLabel(role) : undefined}
              className="text-sidebar-foreground"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            <DashboardNav
              items={navItems}
              pathname={pathname}
              onNavigate={closeMobileNav}
            />
          </div>

          <div className="shrink-0 border-t border-sidebar-border bg-sidebar p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <ThemeToggle variant="tabs" />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex-1" />

      <div className="flex items-center gap-2 sm:gap-3">
        {role && (
          <Badge variant="outline" className="hidden sm:inline-flex">
            {getRoleLabel(role)}
          </Badge>
        )}
        <ThemeToggle />
        <NotificationCenter />
        <MessageInboxButton />
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8 ring-1 ring-border/50">
            {imageUrl && !imageFailed ? (
              <AvatarImage
                src={imageUrl}
                alt={userName || "کاربر"}
                className="object-cover"
                onLoadingStatusChange={(status) => {
                  if (status === "error") setImageFailed(true);
                }}
              />
            ) : null}
            <AvatarFallback className="bg-brand-muted text-xs text-brand">
              {initials || "ک"}
            </AvatarFallback>
          </Avatar>
          {userName && (
            <span className="hidden text-sm font-medium sm:inline">
              {userName}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
