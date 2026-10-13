"use client";

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatCurrency } from "@/lib/utils";
import { parseNumberInput, type ContractScopeInput } from "@/lib/contract-project";

function FieldLabel({
  children,
  htmlFor,
  required,
}: {
  children: ReactNode;
  htmlFor?: string;
  required?: boolean;
}) {
  return (
    <Label htmlFor={htmlFor} className="text-sm font-medium">
      {children}
      {required ? <span className="ms-1 text-destructive">*</span> : null}
    </Label>
  );
}

function MoneyTile({
  label,
  amount,
  tone = "default",
}: {
  label: string;
  amount: number;
  tone?: "default" | "brand";
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col justify-center rounded-xl border px-4 py-3",
        tone === "brand"
          ? "border-brand/25 bg-brand/5"
          : "border-border/80 bg-muted/20",
      )}
    >
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p
        dir="ltr"
        className={cn(
          "mt-1 text-right text-lg font-black tabular-nums [unicode-bidi:isolate]",
          tone === "brand" && "text-brand",
        )}
      >
        {formatCurrency(amount)}
      </p>
    </div>
  );
}

export function ContractScopeFields({
  idPrefix,
  value,
  onChange,
  showCommercials = true,
  commercialsLocked = false,
  commercialsRequired = true,
  scopeRequired = true,
  lockedPrice,
  received = 0,
}: {
  idPrefix: string;
  value: ContractScopeInput;
  onChange: (patch: Partial<ContractScopeInput>) => void;
  showCommercials?: boolean;
  /** Price and terms are fixed once the contract is locked in CRM. */
  commercialsLocked?: boolean;
  commercialsRequired?: boolean;
  scopeRequired?: boolean;
  lockedPrice?: number;
  received?: number;
}) {
  const typedPrice = parseNumberInput(value.agreedPrice);
  const price = commercialsLocked
    ? lockedPrice ?? 0
    : typedPrice != null && Number.isFinite(typedPrice) && typedPrice > 0
      ? typedPrice
      : 0;
  const remaining = Math.max(0, price - received);
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {!showCommercials ? null : commercialsLocked ? (
        <MoneyTile label="قیمت مجموعی پروژه" amount={price} />
      ) : (
        <div className="space-y-2">
          <FieldLabel htmlFor={id("price")} required={commercialsRequired}>
            قیمت مجموعی پروژه
          </FieldLabel>
          <div className="relative">
            <Input
              id={id("price")}
              dir="ltr"
              inputMode="decimal"
              placeholder="0"
              value={value.agreedPrice}
              onChange={(event) => onChange({ agreedPrice: event.target.value })}
              className="h-11 pe-14 text-right tabular-nums"
            />
            <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3">
              <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-bold tracking-wide text-muted-foreground">
                AFN
              </span>
            </span>
          </div>
        </div>
      )}
      {showCommercials ? (
        <MoneyTile label="باقی مانده" amount={remaining} tone="brand" />
      ) : null}

      <div className="space-y-2">
        <FieldLabel htmlFor={id("videos")} required={scopeRequired}>
          تعداد ویدیو
        </FieldLabel>
        <Input
          id={id("videos")}
          dir="ltr"
          inputMode="numeric"
          placeholder="0"
          value={value.videoCount}
          onChange={(event) => onChange({ videoCount: event.target.value })}
          className="h-11 text-right tabular-nums"
        />
      </div>
      <div className="space-y-2">
        <FieldLabel htmlFor={id("posters")}>تعداد پوستر</FieldLabel>
        <Input
          id={id("posters")}
          dir="ltr"
          inputMode="numeric"
          placeholder="0"
          value={value.posterCount}
          onChange={(event) => onChange({ posterCount: event.target.value })}
          className="h-11 text-right tabular-nums"
        />
      </div>

      <div className="space-y-2">
        <FieldLabel htmlFor={id("start")} required={scopeRequired}>
          تاریخ شروع قرارداد
        </FieldLabel>
        <Input
          id={id("start")}
          type="date"
          value={value.startDate}
          max={value.endDate || undefined}
          onChange={(event) => onChange({ startDate: event.target.value })}
          className="h-11"
        />
      </div>
      <div className="space-y-2">
        <FieldLabel htmlFor={id("end")} required={scopeRequired}>
          تاریخ ختم قرارداد
        </FieldLabel>
        <Input
          id={id("end")}
          type="date"
          value={value.endDate}
          min={value.startDate || undefined}
          onChange={(event) => onChange({ endDate: event.target.value })}
          className="h-11"
        />
      </div>

      {showCommercials ? (
        <div className="space-y-2 sm:col-span-2">
          <FieldLabel
            htmlFor={id("terms")}
            required={commercialsRequired && !commercialsLocked}
          >
            شرایط توافق شده
          </FieldLabel>
          {commercialsLocked ? (
            <p className="whitespace-pre-wrap rounded-xl border border-border/80 bg-muted/20 px-4 py-3 text-sm leading-7">
              {value.agreedTerms.trim() || "—"}
            </p>
          ) : (
            <Textarea
              id={id("terms")}
              rows={4}
              className="min-h-[110px] resize-y leading-7"
              placeholder="شرایط پرداخت، زمان‌بندی تحویل و تعهدات طرفین"
              value={value.agreedTerms}
              onChange={(event) => onChange({ agreedTerms: event.target.value })}
            />
          )}
        </div>
      ) : null}

      {showCommercials && commercialsLocked ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground sm:col-span-2">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          قیمت و شرایط قفل است و از پرونده مشتری در CRM و فروش تغییر می‌کند.
        </p>
      ) : null}
    </div>
  );
}
