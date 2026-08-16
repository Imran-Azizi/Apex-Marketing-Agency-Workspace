"use client";

import { useCallback, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Check, Laptop, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ThemeValue = "light" | "dark" | "system";

const THEME_OPTIONS: {
  value: ThemeValue;
  label: string;
  description: string;
  icon: typeof Sun;
}[] = [
  {
    value: "light",
    label: "روشن",
    description: "تم روشن",
    icon: Sun,
  },
  {
    value: "dark",
    label: "تاریک",
    description: "تم تاریک",
    icon: Moon,
  },
  {
    value: "system",
    label: "سیستم",
    description: "مطابق سیستم‌عامل",
    icon: Laptop,
  },
];

function enableThemeTransition() {
  const root = document.documentElement;
  root.classList.add("theme-transition");
  window.setTimeout(() => root.classList.remove("theme-transition"), 280);
}

interface ThemeToggleProps {
  /**
   * `icon` — compact header dropdown.
   * `panel` — large cards for settings/profile.
   * `tabs` — segmented control for mobile sidebars/menus.
   */
  variant?: "icon" | "panel" | "tabs";
  /** Visual tone for the `tabs` variant. Defaults to sidebar styling. */
  surface?: "sidebar" | "default";
  className?: string;
}

export function ThemeToggle({
  variant = "icon",
  surface = "sidebar",
  className,
}: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectTheme = useCallback(
    (value: ThemeValue) => {
      enableThemeTransition();
      setTheme(value);
    },
    [setTheme],
  );

  const active = (theme as ThemeValue | undefined) ?? "system";

  if (variant === "panel") {
    return (
      <div
        className={cn("grid grid-cols-3 gap-2", className)}
        role="radiogroup"
        aria-label="انتخاب تم"
      >
        {THEME_OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = mounted && active === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => selectTheme(option.value)}
              className={cn(
                "relative flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-center transition-all",
                "hover:border-brand/40 hover:bg-accent/60",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                selected
                  ? "border-brand bg-brand/10 text-brand shadow-sm ring-1 ring-brand/20"
                  : "border-border/70 bg-background text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  selected ? "bg-brand/15 text-brand" : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-sm font-semibold text-foreground">
                {option.label}
              </span>
              <span className="text-[11px] leading-tight text-muted-foreground">
                {option.description}
              </span>
              {selected && (
                <span className="absolute start-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-brand-foreground">
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === "tabs") {
    const isSidebar = surface === "sidebar";
    return (
      <div className={cn("w-full", className)}>
        <p
          className={cn(
            "mb-2 px-0.5 text-[11px] font-medium",
            isSidebar
              ? "text-sidebar-foreground/55"
              : "text-muted-foreground",
          )}
        >
          ظاهر برنامه
        </p>
        <div
          className={cn(
            "grid grid-cols-3 gap-1 rounded-xl p-1",
            isSidebar ? "bg-sidebar-border/60" : "bg-muted/70",
          )}
          role="tablist"
          aria-label="انتخاب تم"
        >
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = mounted && active === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => selectTheme(option.value)}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-center transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isSidebar
                    ? "focus-visible:ring-offset-sidebar"
                    : "focus-visible:ring-offset-background",
                  selected
                    ? isSidebar
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm shadow-black/15"
                      : "bg-brand text-brand-foreground shadow-sm"
                    : isSidebar
                      ? "text-sidebar-foreground/70 hover:bg-sidebar-border hover:text-sidebar-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="text-[11px] font-semibold leading-none">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const TriggerIcon = !mounted
    ? Laptop
    : active === "system"
      ? Laptop
      : resolvedTheme === "dark"
        ? Moon
        : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative shrink-0", className)}
          aria-label="تغییر تم نمایش"
        >
          <TriggerIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[11rem]">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          ظاهر برنامه
        </DropdownMenuLabel>
        {THEME_OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = mounted && active === option.value;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => selectTheme(option.value)}
              className={cn(
                "cursor-pointer gap-2",
                selected && "bg-accent text-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{option.label}</span>
              {selected && <Check className="h-3.5 w-3.5 text-brand" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
