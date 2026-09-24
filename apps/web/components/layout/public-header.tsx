"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";
import {
  BriefcaseBusiness,
  Home,
  Images,
  Mail,
  Menu,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Logo } from "@/components/brand/logo";
import {
  PUBLIC_HEADER_HEIGHT_CLASS,
  PUBLIC_NAV_ITEMS,
  PUBLIC_SECTION_IDS,
  NO_PUBLIC_SECTIONS,
  useActiveSection,
  type PublicSectionId,
} from "@/components/public/use-active-section";
import {
  isPublicNavActive,
  usePublicHeaderElevated,
  usePublicSectionNav,
} from "@/components/public/use-public-nav";
import { cn } from "@/lib/utils";

const navLinkBase =
  "public-nav-link relative rounded-full px-2.5 py-1.5 text-[13px] font-medium outline-none transition-[color,background-color,box-shadow] duration-200 ease-out lg:px-3.5 lg:text-sm motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const PUBLIC_NAV_ICONS: Record<PublicSectionId, LucideIcon> = {
  home: Home,
  services: BriefcaseBusiness,
  portfolio: Images,
  customers: Users,
  contact: Mail,
};

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const { pathname, onHome, goToSection } = usePublicSectionNav();
  const { sentinelRef, elevated } = usePublicHeaderElevated();
  const { active: activeSection, setActive: setActiveSection } =
    useActiveSection(onHome ? PUBLIC_SECTION_IDS : NO_PUBLIC_SECTIONS);
  const compact = elevated || open;

  function goToItem(id: PublicSectionId, event?: MouseEvent) {
    event?.preventDefault();
    setActiveSection(id);
    const wasOpen = open;
    setOpen(false);
    if (wasOpen) {
      window.setTimeout(() => goToSection(id), 120);
      return;
    }
    goToSection(id);
  }

  function isActive(id: PublicSectionId) {
    return isPublicNavActive(id, { onHome, pathname, activeSection });
  }

  return (
    <>
      <div ref={sentinelRef} className="h-0 w-full" aria-hidden />
      <header
        className={cn(
          "fixed start-0 end-0 top-0 z-40",
          "border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-out",
          "motion-reduce:transition-none",
          compact
            ? "border-border/70 bg-background/85 shadow-[0_8px_24px_-12px_hsl(var(--foreground)/0.12)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/75 dark:shadow-[0_8px_28px_-12px_rgb(0_0_0_/0.55)]"
            : "border-transparent bg-background/35 backdrop-blur-md supports-[backdrop-filter]:bg-background/20",
        )}
      >
        <div
          className={cn(
            "mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8",
            PUBLIC_HEADER_HEIGHT_CLASS,
          )}
        >
          <a
            href="/#home"
            onClick={(event) => goToItem("home", event)}
            className="group flex shrink-0 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="اپیکس — بازگشت به خانه"
          >
            <Logo
              size="md"
              className="motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:scale-[1.02]"
              wordmarkClassName="text-foreground"
            />
          </a>

          <nav
            className={cn(
              "hidden items-center gap-0.5 rounded-full border p-1 md:flex lg:gap-1",
              "transition-[background-color,border-color] duration-300 motion-reduce:transition-none",
              compact
                ? "border-border/70 bg-muted/50"
                : "border-border/40 bg-muted/30",
            )}
            aria-label="ناوبری صفحه"
          >
            {PUBLIC_NAV_ITEMS.map((item) => {
              const active = isActive(item.id);
              return (
                <a
                  key={item.id}
                  href={`/#${item.id}`}
                  aria-current={active ? "page" : undefined}
                  onClick={(event) => goToItem(item.id, event)}
                  className={cn(
                    navLinkBase,
                    active
                      ? "bg-brand text-brand-foreground shadow-sm shadow-brand/20"
                      : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
                  )}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          <div className="flex items-center gap-1 sm:gap-1.5">
            <ThemeToggle className="h-9 w-9 rounded-full" />
            <Button
              variant="outline"
              size="sm"
              className="hidden h-9 rounded-full border-border/80 px-4 public-lift lg:inline-flex"
              asChild
            >
              <Link href="/login">ورود تیم</Link>
            </Button>
            <Button
              size="sm"
              variant="brand"
              className="public-lift h-9 rounded-full px-3 text-xs shadow-sm shadow-brand/20 sm:px-4 sm:text-sm"
              asChild
            >
              <Link href="/portal/login">پورتال مشتری</Link>
            </Button>

            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full md:hidden"
                  aria-label={open ? "بستن منو" : "باز کردن منو"}
                  aria-expanded={open}
                  aria-controls="public-mobile-nav"
                >
                  {open ? (
                    <X className="h-5 w-5" aria-hidden />
                  ) : (
                    <Menu className="h-5 w-5" aria-hidden />
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                showCloseButton={false}
                className={cn(
                  "flex w-[min(100%,20.5rem)] flex-col gap-0 overflow-hidden border-border/50 p-0 sm:max-w-none",
                  "bg-gradient-to-b from-background via-background to-muted/25",
                )}
              >
                <SheetTitle className="sr-only">منوی وب‌سایت</SheetTitle>
                <SheetDescription className="sr-only">
                  پیوندهای صفحه اصلی و ورود
                </SheetDescription>

                <div className="relative flex h-[3.75rem] shrink-0 items-center justify-between gap-3 px-5">
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-l from-transparent via-border/80 to-transparent"
                    aria-hidden
                  />
                  <Logo size="sm" wordmarkClassName="text-foreground" />
                  <SheetClose asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-full border-border/70 bg-background/80 shadow-sm"
                      aria-label="بستن منو"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </SheetClose>
                </div>

                <nav
                  id="public-mobile-nav"
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5"
                  aria-label="ناوبری موبایل"
                >
                  <ul className="space-y-1">
                    {PUBLIC_NAV_ITEMS.map((item) => {
                      const active = isActive(item.id);
                      const Icon = PUBLIC_NAV_ICONS[item.id];
                      return (
                        <li key={item.id}>
                          <a
                            href={`/#${item.id}`}
                            aria-current={active ? "page" : undefined}
                            onClick={(event) => goToItem(item.id, event)}
                            className={cn(
                              "group relative flex min-h-12 w-full items-center gap-3 overflow-hidden rounded-2xl px-3.5 py-3 text-start text-[0.95rem] font-medium outline-none transition-[color,background-color,transform,box-shadow] duration-200 ease-out",
                              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                              "active:scale-[0.99]",
                              active
                                ? "bg-brand/[0.12] text-brand shadow-[inset_0_0_0_1px_hsl(var(--brand)/0.18)]"
                                : "text-foreground/85 hover:bg-muted/60 hover:text-foreground",
                            )}
                          >
                            <span
                              className={cn(
                                "absolute inset-y-2 start-0 w-0.5 rounded-full transition-colors",
                                active ? "bg-brand" : "bg-transparent",
                              )}
                              aria-hidden
                            />
                            <span
                              className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                                active
                                  ? "bg-brand/15 text-brand"
                                  : "bg-muted/80 text-muted-foreground group-hover:bg-muted group-hover:text-foreground",
                              )}
                              aria-hidden
                            >
                              <Icon className="h-4 w-4" strokeWidth={2} />
                            </span>
                            <span className="min-w-0 flex-1 tracking-tight">
                              {item.label}
                            </span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="my-5 h-px bg-gradient-to-l from-transparent via-border/70 to-transparent" />

                  <div className="space-y-2">
                    <Link
                      href="/login"
                      prefetch={false}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex min-h-12 items-center rounded-2xl border border-border/70 bg-card/60 px-3.5 py-3 text-sm font-medium text-foreground/90 outline-none",
                        "transition-colors hover:border-border hover:bg-card hover:text-foreground",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      )}
                    >
                      ورود تیم
                    </Link>
                    <Link
                      href="/portal/login"
                      prefetch={false}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex min-h-12 items-center justify-center rounded-2xl bg-brand px-3.5 py-3 text-center text-sm font-semibold text-brand-foreground outline-none",
                        "shadow-md shadow-brand/25",
                        "transition-transform duration-200 active:scale-[0.99]",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        "motion-reduce:transition-none motion-reduce:active:scale-100",
                      )}
                    >
                      پورتال مشتری
                    </Link>
                  </div>
                </nav>

                <div className="shrink-0 border-t border-border/50 bg-muted/15 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <div className="rounded-2xl border border-border/60 bg-card/70 p-3 shadow-sm">
                    <ThemeToggle variant="tabs" surface="default" />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <div className={cn("shrink-0", PUBLIC_HEADER_HEIGHT_CLASS)} aria-hidden />
    </>
  );
}
