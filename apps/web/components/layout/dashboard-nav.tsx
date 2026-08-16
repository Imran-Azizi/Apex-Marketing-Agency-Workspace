"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  flattenNavLinks,
  isNavGroup,
  type NavItem,
} from "@/lib/rbac";

const LINK_CLASS =
  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors";

function isHrefActive(pathname: string, href: string, allHrefs: string[]) {
  const hasMoreSpecific = allHrefs.some(
    (other) =>
      other !== href &&
      other.startsWith(`${href}/`) &&
      (pathname === other || pathname.startsWith(`${other}/`)),
  );
  return (
    !hasMoreSpecific &&
    (pathname === href || pathname.startsWith(`${href}/`))
  );
}

function navLinkClass(active: boolean, nested = false) {
  return cn(
    LINK_CLASS,
    nested && "py-2 text-[13px]",
    active
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-sidebar-foreground/80 hover:bg-sidebar-border hover:text-sidebar-foreground",
  );
}

function SidebarLink({
  item,
  active,
  nested,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  nested?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={navLinkClass(active, nested)}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {item.label}
    </Link>
  );
}

function SidebarGroup({
  item,
  pathname,
  allHrefs,
  onNavigate,
}: {
  item: NavItem & { children: NavItem[] };
  pathname: string;
  allHrefs: string[];
  onNavigate?: () => void;
}) {
  const panelId = useId();
  const childActive = item.children.some((child) =>
    isHrefActive(pathname, child.href, allHrefs),
  );
  const [open, setOpen] = useState(childActive);
  const Icon = item.icon;

  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          LINK_CLASS,
          "w-full text-start",
          childActive
            ? "bg-sidebar-border/70 text-sidebar-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-border hover:text-sidebar-foreground",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 opacity-70 transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <div
        id={panelId}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden" inert={!open || undefined}>
          <ul
            className="ms-3 mt-1 space-y-0.5 border-s border-sidebar-border/80 ps-2"
            role="list"
          >
            {item.children.map((child) => (
              <li key={child.href}>
                <SidebarLink
                  item={child}
                  nested
                  active={isHrefActive(pathname, child.href, allHrefs)}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function DashboardNav({
  items,
  pathname,
  onNavigate,
  className,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
  className?: string;
}) {
  const allHrefs = flattenNavLinks(items).map((item) => item.href);

  return (
    <nav className={cn("space-y-1", className)} aria-label="ناوبری پنل">
      {items.map((item) =>
        isNavGroup(item) ? (
          <SidebarGroup
            key={item.href}
            item={item}
            pathname={pathname}
            allHrefs={allHrefs}
            onNavigate={onNavigate}
          />
        ) : (
          <SidebarLink
            key={item.href}
            item={item}
            active={isHrefActive(pathname, item.href, allHrefs)}
            onNavigate={onNavigate}
          />
        ),
      )}
    </nav>
  );
}
