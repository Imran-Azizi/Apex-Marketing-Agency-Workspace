"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { HorizontalScroll } from "@/components/shared/horizontal-scroll";

const TABS: Array<{ href: string; label: string; exact?: boolean }> = [
  { href: "/business-assistant", label: "مشاور کسب‌وکار", exact: true },
  { href: "/business-assistant/chat", label: "گفتگو" },
];

export function BusinessAssistantSubnav() {
  const pathname = usePathname();

  return (
    <HorizontalScroll className="mb-6" bordered={false}>
      <nav className="flex min-w-max gap-1 rounded-lg border border-border/60 bg-muted/30 p-1">
        {TABS.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </HorizontalScroll>
  );
}
