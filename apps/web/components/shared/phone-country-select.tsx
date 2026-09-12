"use client";

import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  getCountryCallingCode,
  type Country,
} from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

function matchesCountryQuery(opt: CountryOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const code = callingCode(opt.value)?.toLowerCase() || "";
  const digits = code.replace("+", "");
  const iso = (opt.value || "").toLowerCase();
  const label = opt.label.toLowerCase();
  const compactQuery = q.replace(/\s+/g, "").replace(/^\+/, "");

  return (
    label.includes(q) ||
    iso.includes(q) ||
    code.includes(q) ||
    digits.includes(compactQuery) ||
    `${iso}${digits}`.includes(compactQuery) ||
    `${label} ${code}`.toLowerCase().includes(q)
  );
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
  const searchRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const locked = disabled || readOnly;

  const selectable = React.useMemo(
    () => options.filter((opt) => !opt.divider && opt.value),
    [options],
  );

  const filtered = React.useMemo(() => {
    if (!query.trim()) return selectable;
    return selectable.filter((opt) => matchesCountryQuery(opt, query));
  }, [selectable, query]);

  const selected = selectable.find((opt) => opt.value === value) || null;
  const selectedCode = callingCode(value);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const id = window.requestAnimationFrame(() => {
      searchRef.current?.focus();
      if (!value || !listRef.current) return;
      const active = listRef.current.querySelector<HTMLElement>(
        `[data-country="${value}"]`,
      );
      active?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, value]);

  return (
    <DropdownMenu
      modal={false}
      open={open}
      onOpenChange={(next) => {
        if (locked) return;
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <DropdownMenuTrigger asChild disabled={locked}>
        <button
          type="button"
          disabled={locked}
          aria-label={
            selected
              ? `${selected.label} ${selectedCode || ""}`.trim()
              : "انتخاب کشور"
          }
          className={cn(
            "PhoneInputCountry inline-flex h-11 min-h-11 min-w-[5.75rem] shrink-0 items-center gap-1.5 self-stretch rounded-none border-0 bg-transparent px-2.5 text-sm shadow-none outline-none transition-colors",
            "hover:bg-muted/45 focus-visible:bg-muted/55 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/25",
            "disabled:cursor-not-allowed disabled:opacity-50",
            open && "bg-muted/35",
            className,
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
      </DropdownMenuTrigger>

      <DropdownMenuContent
        data-phone-country-menu=""
        align="start"
        side="bottom"
        sideOffset={8}
        collisionPadding={12}
        className={cn(
          "z-[200] w-[min(340px,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-border/80 bg-popover p-0 text-popover-foreground shadow-lg",
        )}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
        }}
      >
        <div dir="ltr">
        <div className="sticky top-0 z-[1] border-b border-border/70 bg-popover p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجوی کشور، کد یا +971…"
              className="h-9 rounded-lg border-border/70 pe-3 ps-8 text-sm"
              dir="auto"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              onPointerDown={(e) => e.stopPropagation()}
              // Prevent Radix menu typeahead / dialog from hijacking keystrokes.
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        <div
          ref={listRef}
          className="max-h-64 overflow-y-auto overscroll-contain p-1"
          onWheel={(e) => e.stopPropagation()}
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
                <DropdownMenuItem
                  key={opt.value}
                  data-country={opt.value}
                  textValue={`${opt.label} ${opt.value} ${code}`}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
                    isActive && "bg-brand/10 focus:bg-brand/10",
                  )}
                  onSelect={() => {
                    onChange(opt.value);
                    setQuery("");
                  }}
                >
                  <FlagIcon country={opt.value} />
                  <span className="min-w-0 flex-1 truncate text-start">
                    {opt.label}
                  </span>
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
                </DropdownMenuItem>
              );
            })
          )}
        </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
