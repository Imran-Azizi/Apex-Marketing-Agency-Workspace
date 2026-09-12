"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe } from "lucide-react";
import { api, ensureCsrf } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  PUBLIC_COPY_BOOTSTRAP,
  PUBLIC_COPY_FIELDS,
  PUBLIC_COPY_MAX,
  readPublicCopyText,
  type PublicCopyField,
} from "@/lib/public-copy";

type SettingRecord = {
  id: string;
  key: string;
  value: unknown;
  updatedAt: string;
};

export function PublicCopyPanel({
  settings,
  canEdit,
}: {
  settings: SettingRecord[] | undefined;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const saved = useMemo(() => {
    const next: Record<PublicCopyField, string> = {
      company: "",
      services: "",
      portfolio: "",
      customers: "",
      contact: "",
    };
    for (const item of PUBLIC_COPY_FIELDS) {
      const row = settings?.find((s) => s.key === item.key);
      next[item.field] = row
        ? readPublicCopyText(row.value)
        : PUBLIC_COPY_BOOTSTRAP[item.field];
    }
    return next;
  }, [settings]);

  const [draft, setDraft] = useState(saved);
  const [savingField, setSavingField] = useState<PublicCopyField | null>(null);
  const savedRef = useRef(saved);

  useEffect(() => {
    setDraft((prev) => {
      const next = { ...prev };
      for (const item of PUBLIC_COPY_FIELDS) {
        const field = item.field;
        if (prev[field] === savedRef.current[field]) {
          next[field] = saved[field];
        }
      }
      savedRef.current = saved;
      return next;
    });
  }, [saved]);

  const saveMut = useMutation({
    mutationFn: async ({
      field,
      text,
    }: {
      field: PublicCopyField;
      text: string;
    }) => {
      const item = PUBLIC_COPY_FIELDS.find((entry) => entry.field === field);
      if (!item) throw new Error("بخش نامعتبر است");
      await ensureCsrf();
      const res = await api.put(`/settings/${item.key}`, {
        value: { text },
      });
      if (!res.data.success) {
        throw new Error(res.data.error?.message || "خطا در ذخیره توضیحات");
      }
      return field;
    },
    onSuccess: (field, { text }) => {
      const item = PUBLIC_COPY_FIELDS.find((entry) => entry.field === field);
      setDraft((prev) => ({ ...prev, [field]: text }));
      savedRef.current = { ...savedRef.current, [field]: text };
      toast.success(
        item ? `توضیحات «${item.section}» ذخیره شد` : "توضیحات ذخیره شد",
      );
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "خطا در ذخیره توضیحات"),
    onSettled: () => setSavingField(null),
  });

  function saveField(field: PublicCopyField) {
    if (!canEdit || savingField) return;
    const text = draft[field];
    if (text.length > PUBLIC_COPY_MAX) {
      toast.error(`توضیحات نباید بیشتر از ${PUBLIC_COPY_MAX} کاراکتر باشد`);
      return;
    }
    setSavingField(field);
    saveMut.mutate({ field, text: text.trim() });
  }

  const latestUpdate = (settings || [])
    .filter((row) => PUBLIC_COPY_FIELDS.some((item) => item.key === row.key))
    .map((row) => row.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  return (
    <section
      className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
      aria-labelledby="public-copy-settings-title"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 bg-muted/20 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Globe className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-1 text-start">
            <h2
              id="public-copy-settings-title"
              className="text-base font-semibold tracking-tight text-foreground"
            >
              تنظیمات محتوای وب‌سایت عمومی
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              توضیحات هر بخش از وب‌سایت را جداگانه ویرایش و ذخیره کنید
            </p>
            {latestUpdate ? (
              <p className="text-[11px] text-muted-foreground">
                آخرین بروزرسانی: {formatDate(latestUpdate)}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="space-y-5 p-4 sm:p-5">
        {PUBLIC_COPY_FIELDS.map((item) => {
          const value = draft[item.field];
          const dirty = value.trim() !== saved[item.field].trim();
          const busy = savingField === item.field;
          const overLimit = value.length > PUBLIC_COPY_MAX;
          return (
            <div
              key={item.key}
              className="space-y-2 rounded-xl border border-border/60 bg-background/70 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <Label htmlFor={`public-copy-${item.field}`} className="text-sm">
                    {item.label}
                  </Label>
                  <p className="text-xs leading-6 text-muted-foreground">
                    {item.hint}
                  </p>
                </div>
                <p
                  className={cn(
                    "text-[11px] tabular-nums text-muted-foreground",
                    overLimit && "font-medium text-destructive",
                  )}
                >
                  {value.length} / {PUBLIC_COPY_MAX}
                </p>
              </div>
              <Textarea
                id={`public-copy-${item.field}`}
                dir="rtl"
                rows={4}
                value={value}
                disabled={!canEdit || busy}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, [item.field]: e.target.value }))
                }
                placeholder={`توضیحات بخش ${item.section}`}
                className="min-h-[6.5rem] resize-y text-sm leading-7"
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="brand"
                  disabled={!canEdit || !dirty || overLimit || Boolean(savingField)}
                  isLoading={busy}
                  loadingText="در حال ذخیره..."
                  onClick={() => saveField(item.field)}
                >
                  ذخیره این بخش
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
