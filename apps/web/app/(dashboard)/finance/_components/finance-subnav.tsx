"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { HorizontalScroll } from "@/components/shared/horizontal-scroll";
import { useHasPermission } from "@/lib/permissions";

const TABS: Array<{
  href: string;
  label: string;
  exact?: boolean;
  permission?: string;
}> = [
  { href: "/finance", label: "داشبورد", exact: true },
  { href: "/finance/projects", label: "پروژه‌ها", permission: "finance.view" },
  { href: "/finance/expenses", label: "مصارف شرکت" },
  { href: "/finance/salaries", label: "معاشات" },
  { href: "/finance/pnl", label: "سود و زیان" },
];

export function FinanceSubnav() {
  const pathname = usePathname();
  const canViewFinance = useHasPermission("finance.view");
  const canViewProjects = useHasPermission("projects.view");

  const visibleTabs = TABS.filter((tab) => {
    if (!tab.permission) return true;
    if (tab.href === "/finance/projects") {
      return canViewFinance || canViewProjects;
    }
    return canViewFinance;
  });

  return (
    <HorizontalScroll className="mb-6" bordered={false}>
      <nav className="flex min-w-max gap-1 rounded-lg border border-border/60 bg-muted/30 p-1">
        {visibleTabs.map((tab) => {
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
