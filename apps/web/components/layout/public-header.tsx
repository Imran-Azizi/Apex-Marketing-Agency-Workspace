"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  PUBLIC_SECTION_IDS,
  scrollToSection,
  useActiveSection,
} from "@/components/public/use-active-section";
import { cn } from "@/lib/utils";

const navItems = [
  { id: "home", label: "خانه" },
  { id: "services", label: "خدمات" },
  { id: "styles", label: "سبک‌های ویدیو" },
  { id: "narrators", label: "نمونه صدا" },
] as const;

export function PublicHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const onHome = pathname === "/";
  const activeSection = useActiveSection(PUBLIC_SECTION_IDS);

  function goToSection(id: string) {
    setOpen(false);
    if (onHome) {
      scrollToSection(id);
      return;
    }
    router.push(`/#${id}`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => goToSection("home")}
          className="group flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="اپیکس — بازگشت به بالا"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-sm font-bold text-brand-foreground shadow-sm shadow-brand/25 transition-transform group-hover:scale-105">
            ا
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground">
            اپیکس
          </span>
        </button>

        <nav
          className="hidden items-center gap-1 rounded-full border border-border/60 bg-muted/40 p-1 md:flex"
          aria-label="ناوبری صفحه"
        >
          {navItems.map((item) => {
            const active = onHome && activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => goToSection(item.id)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium transition-all",
                  active
                    ? "bg-brand text-brand-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background hover:text-foreground",
                )}
              >
                {item.label}
              </button>
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
            <SheetContent side="right" className="w-[min(100%,20rem)]">
              <div className="mb-5 flex items-center justify-between border-b border-border/60 pb-4">
                <span className="text-sm font-semibold">منو</span>
                <ThemeToggle />
              </div>
              <nav className="flex flex-col gap-1" aria-label="ناوبری موبایل">
                {navItems.map((item) => {
                  const active = onHome && activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => goToSection(item.id)}
                      className={cn(
                        "rounded-xl px-3 py-2.5 text-start text-sm font-medium transition-colors",
                        active
                          ? "bg-brand/10 text-brand"
                          : "hover:bg-accent",
                      )}
                    >
                      {item.label}
                    </button>
                  );
                })}
                <div className="my-3 h-px bg-border/60" />
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-accent"
                >
                  ورود تیم
                </Link>
                <Link
                  href="/portal/login"
                  onClick={() => setOpen(false)}
                  className="rounded-xl bg-brand px-3 py-2.5 text-center text-sm font-medium text-brand-foreground"
                >
                  پورتال مشتری
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
