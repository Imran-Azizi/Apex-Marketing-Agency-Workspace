"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";
import { Menu, X } from "lucide-react";
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
  "relative rounded-full px-2.5 py-1.5 text-[13px] font-medium outline-none transition-colors duration-200 lg:px-3.5 lg:text-sm motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const { pathname, onHome, goToSection } = usePublicSectionNav();
  const { sentinelRef, elevated } = usePublicHeaderElevated();
  const { active: activeSection, setActive: setActiveSection } = useActiveSection(
    onHome ? PUBLIC_SECTION_IDS : NO_PUBLIC_SECTIONS,
  );
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
              className="hidden h-9 rounded-full border-border/80 px-4 lg:inline-flex"
              asChild
            >
              <Link href="/login">ورود تیم</Link>
            </Button>
            <Button
              size="sm"
              variant="brand"
              className="h-9 rounded-full px-3 text-xs shadow-sm shadow-brand/20 motion-safe:transition-transform motion-safe:hover:-translate-y-px sm:px-4 sm:text-sm"
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
                className="flex w-[min(100%,20rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
              >
                <SheetTitle className="sr-only">منوی وب‌سایت</SheetTitle>
                <SheetDescription className="sr-only">
                  پیوندهای صفحه اصلی و ورود
                </SheetDescription>
                <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4">
                  <Logo size="sm" wordmarkClassName="text-foreground" />
                  <SheetClose asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full"
                      aria-label="بستن منو"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </SheetClose>
                </div>
                <nav
                  id="public-mobile-nav"
                  className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-4"
                  aria-label="ناوبری موبایل"
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
                          "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm font-medium outline-none transition-colors",
                          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          active
                            ? "bg-brand/10 text-brand"
                            : "text-foreground hover:bg-accent",
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            active ? "bg-brand" : "bg-border",
                          )}
                          aria-hidden
                        />
                        {item.label}
                      </a>
                    );
                  })}
                  <div className="my-3 h-px bg-border/60" />
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-center rounded-xl px-3 py-2.5 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    ورود تیم
                  </Link>
                  <Link
                    href="/portal/login"
                    onClick={() => setOpen(false)}
                    className="mt-1 flex min-h-11 items-center justify-center rounded-xl bg-brand px-3 py-2.5 text-center text-sm font-medium text-brand-foreground shadow-sm shadow-brand/20 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    پورتال مشتری
                  </Link>
                </nav>
                <div className="shrink-0 border-t border-border/60 bg-muted/20 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <ThemeToggle variant="tabs" surface="default" />
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
