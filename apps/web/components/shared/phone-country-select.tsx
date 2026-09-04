"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  getCountryCallingCode,
  type Country,
} from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type CountryOption = {
  value?: Country;
  label: string;
  divider?: boolean;
};

export type PhoneCountrySelectProps = {
  value?: Country;
  onChange: (value: Country | undefined) => void;
  options: CountryOption[];
  disabled?: boolean;
  readOnly?: boolean;
  iconComponent?: React.ComponentType<{
    country?: Country;
    label?: string;
    aspectRatio?: number;
  }>;
  className?: string;
};

function FlagIcon({
  country,
  className,
}: {
  country?: Country;
  className?: string;
}) {
  if (!country) {
    return (
      <span
        className={cn(
          "inline-flex h-4 w-5 items-center justify-center rounded-[2px] bg-muted text-[10px] text-muted-foreground",
          className,
        )}
        aria-hidden
      >
        ?
      </span>
    );
  }
  const Flag = flags[country];
  if (!Flag) {
    return (
      <span className={cn("text-base leading-none", className)} aria-hidden>
        {country}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex h-4 w-5 overflow-hidden rounded-[2px] [&_svg]:h-full [&_svg]:w-full",
        className,
      )}
      aria-hidden
    >
      <Flag title={country} />
    </span>
  );
}

function callingCode(country?: Country): string | null {
  if (!country) return null;
  try {
    return `+${getCountryCallingCode(country)}`;
  } catch {
    return null;
  }
}

export function PhoneCountrySelect({
  value,
  onChange,
  options,
  disabled,
  readOnly,
  className,
}: PhoneCountrySelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [menuStyle, setMenuStyle] = React.useState<React.CSSProperties>({});
  const [mounted, setMounted] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const selectable = React.useMemo(
    () => options.filter((opt) => !opt.divider && opt.value),
    [options],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return selectable;
    return selectable.filter((opt) => {
      const code = callingCode(opt.value)?.toLowerCase() || "";
      const iso = (opt.value || "").toLowerCase();
      const label = opt.label.toLowerCase();
      return (
        label.includes(q) ||
        code.includes(q) ||
        code.replace("+", "").includes(q) ||
        iso.includes(q)
      );
    });
  }, [selectable, query]);

  const selected = selectable.find((opt) => opt.value === value) || null;
  const selectedCode = callingCode(value);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const updateMenuPosition = React.useCallback(() => {
    const trigger = rootRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(320, Math.max(260, window.innerWidth - 24));
    const left = Math.min(
      Math.max(12, rect.left),
      Math.max(12, window.innerWidth - width - 12),
    );
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 320 && rect.top > spaceBelow;
    setMenuStyle({
      position: "fixed",
      left,
      width,
      top: openUp ? undefined : rect.bottom + 6,
      bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
      zIndex: 80,
    });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const onScroll = () => updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, updateMenuPosition]);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
      setQuery("");
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  React.useEffect(() => {
    if (!open || !value || !listRef.current) return;
    const active = listRef.current.querySelector<HTMLElement>(
      `[data-country="${value}"]`,
    );
    active?.scrollIntoView({ block: "nearest" });
  }, [open, value]);

  const locked = disabled || readOnly;

  const menu =
    open && mounted
      ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label="لیست کشورها"
            style={menuStyle}
            className={cn(
              "overflow-hidden rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-lg",
              "animate-in fade-in-0 zoom-in-95",
            )}
          >
            <div className="border-b border-border/70 p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="جستجوی کشور یا کد…"
                  className="h-9 rounded-lg border-border/70 pe-3 ps-8 text-sm"
                  dir="rtl"
                />
              </div>
            </div>

            <div
              ref={listRef}
              className="max-h-64 overflow-y-auto overscroll-contain p-1"
            >
              {filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  کشوری یافت نشد
                </p>
              ) : (
                filtered.map((opt) => {
                  const code = callingCode(opt.value);
                  const isActive = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      data-country={opt.value}
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm outline-none transition-colors",
                        "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent",
                        isActive && "bg-brand/10 text-foreground",
                      )}
                    >
                      <FlagIcon country={opt.value} />
                      <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                      <span
                        dir="ltr"
                        className="shrink-0 tabular-nums text-xs text-muted-foreground"
                      >
                        {code}
                      </span>
                      {isActive ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-brand" />
                      ) : (
                        <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={cn("PhoneInputCountry relative shrink-0", className)}
    >
      <button
        type="button"
        disabled={locked}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={
          selected
            ? `${selected.label} ${selectedCode || ""}`.trim()
            : "انتخاب کشور"
        }
        onClick={() => {
          if (locked) return;
          setOpen((prev) => !prev);
          if (open) setQuery("");
        }}
        className={cn(
          "inline-flex h-full min-w-[5.75rem] items-center gap-1.5 border-0 bg-transparent px-2.5 text-sm outline-none transition-colors",
          "hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/25",
          "disabled:cursor-not-allowed disabled:opacity-50",
          open && "bg-muted/40",
        )}
      >
        <FlagIcon country={value} />
        <span dir="ltr" className="tabular-nums font-medium text-foreground">
          {selectedCode || "—"}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {menu}
    </div>
  );
}
