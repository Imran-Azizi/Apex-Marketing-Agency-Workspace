"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { apiPatch } from "@/lib/api";
import { invalidateFinanceQueries } from "@/lib/finance-queries";
import { cn, formatCurrency, toEnglishDigits } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function parsePositivePrice(value: string): number | null {
  const raw = toEnglishDigits(value).replace(/[,٬\s]/g, "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function displayDraft(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return "";
  return String(amount);
}

export function useUpdateAgreedPrice(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (agreedPrice: number) =>
      apiPatch(`/projects/${projectId}/agreed-price`, { agreedPrice }),
    onSuccess: async () => {
      toast.success("قیمت پروژه به‌روزرسانی شد");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["project"] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["crm-customer"] }),
        queryClient.invalidateQueries({ queryKey: ["crm-customers"] }),
        queryClient.invalidateQueries({ queryKey: ["crm-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
        invalidateFinanceQueries(queryClient),
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "ذخیره قیمت ناموفق بود");
    },
  });
}

/**
 * Inline edit for agreed / total project price — managers only (`canEdit`).
 * Saves via PATCH /projects/:id/agreed-price; remaining & profit recalculate server-side.
 */
export function EditableAgreedPrice({
  projectId,
  amount,
  canEdit = false,
  label,
  valueClassName,
  className,
  tone = "default",
}: {
  projectId: string;
  amount: number | null | undefined;
  canEdit?: boolean;
  label: string;
  valueClassName?: string;
  className?: string;
  tone?: "default" | "brand";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => displayDraft(amount));
  const saveMut = useUpdateAgreedPrice(projectId);

  useEffect(() => {
    if (!editing) setDraft(displayDraft(amount));
  }, [amount, editing]);

  const startEdit = () => {
    setDraft(displayDraft(amount));
    setEditing(true);
  };

  const cancel = () => {
    setDraft(displayDraft(amount));
    setEditing(false);
  };

  const submit = () => {
    const parsed = parsePositivePrice(draft);
    if (parsed == null) {
      toast.error("قیمت پروژه باید عددی بیشتر از صفر باشد.");
      return;
    }
    if (amount != null && Number.isFinite(amount) && parsed === Number(amount)) {
      setEditing(false);
      return;
    }
    saveMut.mutate(parsed, {
      onSuccess: () => setEditing(false),
    });
  };

  const shellTone =
    tone === "brand"
      ? "border-brand/25 bg-brand/5"
      : "border-border/70 bg-muted/20";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border px-4 py-3",
        shellTone,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        {canEdit && !editing ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-brand"
            title="ویرایش قیمت"
            aria-label="ویرایش قیمت"
            onClick={startEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          <div className="relative">
            <Input
              dir="ltr"
              inputMode="decimal"
              autoFocus
              value={draft}
              disabled={saveMut.isPending}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancel();
                }
              }}
              className="h-10 pe-14 text-right tabular-nums"
              placeholder="0"
              aria-label={label}
            />
            <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3">
              <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-bold tracking-wide text-muted-foreground">
                AFN
              </span>
            </span>
          </div>
          <div className="flex items-center justify-end gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={saveMut.isPending}
              onClick={cancel}
              aria-label="انصراف"
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="brand"
              size="icon"
              className="h-8 w-8"
              disabled={saveMut.isPending}
              onClick={submit}
              aria-label="ذخیره قیمت"
            >
              {saveMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      ) : (
        <p
          dir="ltr"
          className={cn(
            "mt-1 text-right text-lg font-bold tabular-nums [unicode-bidi:isolate]",
            tone === "brand" && "text-brand",
            valueClassName,
          )}
        >
          {amount != null && Number.isFinite(amount)
            ? formatCurrency(amount)
            : "—"}
        </p>
      )}
    </div>
  );
}
