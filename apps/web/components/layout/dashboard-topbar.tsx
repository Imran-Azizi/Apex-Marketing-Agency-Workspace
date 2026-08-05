"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { getNavItems, getRoleLabel } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { filePreviewUrl } from "@/lib/upload";
import { Badge } from "@/components/ui/badge";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { ThemeToggle } from "@/components/layout/theme-toggle";

interface DashboardTopbarProps {
  userName?: string;
  role?: string | null;
  profileImage?: string | null;
}

export function DashboardTopbar({
  userName,
  role,
  profileImage,
}: DashboardTopbarProps) {
  const pathname = usePathname();
  const navItems = getNavItems(role);
  const initials = userName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
  const imageUrl = profileImage ? filePreviewUrl(profileImage) : null;

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 lg:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="w-64 bg-sidebar p-0 text-sidebar-foreground"
        >
          <div className="flex h-16 items-center justify-between gap-2 border-b border-sidebar-border px-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-accent text-sm font-bold text-white">
                ا
              </div>
              <div>
                <span className="block text-lg font-bold">اپیکس</span>
                {role && (
                  <span className="text-xs opacity-70">{getRoleLabel(role)}</span>
                )}
              </div>
            </div>
            <ThemeToggle className="text-sidebar-foreground hover:bg-sidebar-border hover:text-sidebar-foreground" />
          </div>
          <nav className="space-y-1 p-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium",
                    active
                      ? "bg-sidebar-accent text-white"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-border",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
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
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8 ring-1 ring-border/50">
            {imageUrl ? (
              <AvatarImage
                src={imageUrl}
                alt={userName || "کاربر"}
                className="object-cover"
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
