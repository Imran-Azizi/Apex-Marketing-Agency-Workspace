"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Logo } from "@/components/brand/logo";
import {
  PUBLIC_SECTION_IDS,
  scrollToSection,
  useActiveSection,
  type PublicSectionId,
} from "@/components/public/use-active-section";
import { cn } from "@/lib/utils";

const navItems: Array<{ id: PublicSectionId; label: string }> = [
  { id: "home", label: "خانه" },
  { id: "services", label: "خدمات" },
  { id: "portfolio", label: "نمونه‌کارها" },
  { id: "narrators", label: "نمونه صدا" },
];

export function PublicHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const onHome = pathname === "/";
  const activeSection = useActiveSection(onHome ? PUBLIC_SECTION_IDS : []);

  function goToItem(id: PublicSectionId) {
    setOpen(false);
    if (onHome) {
      // Let the mobile sheet finish closing before scrolling
      window.setTimeout(() => scrollToSection(id), open ? 120 : 0);
      return;
    }
    router.push(`/#${id}`);
  }

  function isActive(id: PublicSectionId) {
    if (!onHome) return false;
    return activeSection === id;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => goToItem("home")}
          className="group flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="اپیکس — بازگشت به بالا"
        >
          <Logo
            size="lg"
            className="transition-transform group-hover:scale-[1.02]"
            wordmarkClassName="text-foreground"
          />
        </button>

        <nav
          className="hidden items-center gap-1 rounded-full border border-border/60 bg-muted/40 p-1 md:flex"
          aria-label="ناوبری صفحه"
        >
          {navItems.map((item) => {
            const active = isActive(item.id);
            return (
              <a
                key={item.id}
                href={`/#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  goToItem(item.id);
                }}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium transition-all",
                  active
                    ? "bg-brand text-brand-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background hover:text-foreground",
                )}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            className="hidden h-9 rounded-full border-border/80 px-4 sm:inline-flex"
            asChild
          >
            <Link href="/login">ورود تیم</Link>
          </Button>
          <Button
            size="sm"
            variant="brand"
            className="hidden h-9 rounded-full px-4 shadow-sm shadow-brand/20 sm:inline-flex"
            asChild
          >
            <Link href="/portal/login">پورتال مشتری</Link>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="منو"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="flex w-[min(100%,20rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
            >
              <div className="flex h-14 shrink-0 items-center border-b border-border/60 px-4 pe-12">
                <span className="text-sm font-semibold">منو</span>
              </div>
              <nav
                className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-4"
                aria-label="ناوبری موبایل"
              >
                {navItems.map((item) => {
                  const active = isActive(item.id);
                  return (
                    <a
                      key={item.id}
                      href={`/#${item.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        goToItem(item.id);
                      }}
                      className={cn(
                        "block w-full rounded-xl px-3 py-2.5 text-start text-sm font-medium transition-colors",
                        active
                          ? "bg-brand/10 text-brand"
                          : "hover:bg-accent",
                      )}
                    >
                      {item.label}
                    </a>
                  );
                })}
                <div className="my-3 h-px bg-border/60" />
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-accent"
                >
                  ورود تیم
                </Link>
                <Link
                  href="/portal/login"
                  onClick={() => setOpen(false)}
                  className="mt-1 block rounded-xl bg-brand px-3 py-2.5 text-center text-sm font-medium text-brand-foreground"
                >
                  پورتال مشتری
                </Link>
              </nav>
              <div className="shrink-0 border-t border-border/60 bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <ThemeToggle variant="tabs" surface="default" />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
