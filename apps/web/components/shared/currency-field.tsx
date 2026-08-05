"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function CurrencyField({
  id,
  label,
  value,
  onChange,
  placeholder = "0",
  readOnly = false,
  hint,
  error,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  hint?: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2" dir="rtl">
      <Label htmlFor={id} className="block text-xs font-medium text-start">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <div className="relative">
        <Input
          id={id}
          dir="ltr"
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          value={value}
          readOnly={readOnly}
          tabIndex={readOnly ? -1 : undefined}
          onChange={
            readOnly || !onChange ? undefined : (e) => onChange(e.target.value)
          }
          className={cn(
            "h-11 rounded-xl pe-14 ps-3 text-right tabular-nums shadow-sm",
            readOnly
              ? "cursor-default bg-muted/40 text-foreground"
              : "bg-background hover:border-brand/30",
            error && "border-destructive focus-visible:ring-destructive/30",
          )}
        />
        <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3">
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-bold tracking-wide text-muted-foreground">
            AFN
          </span>
        </span>
      </div>
      {error ? (
        <p className="text-[11px] text-destructive text-start">{error}</p>
      ) : hint ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground text-start">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Parse a currency input string; returns null when empty or invalid. */
export function parseCurrencyInput(value: string): number | null {
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function validateCurrencyInput(
  value: string,
  label: string,
): string | undefined {
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned) return `${label} الزامی است`;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return `${label} باید عددی نامنفی باشد`;
  return undefined;
}
