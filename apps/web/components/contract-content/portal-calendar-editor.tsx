"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiPut } from "@/lib/api";
import { formatCount, toDateInputValue } from "@/lib/contract-project";
import {
  CALENDAR_MAX_ROWS,
  CONTENT_LANGUAGE_OPTIONS,
  CONTENT_TYPE_OPTIONS,
  type CalendarRow,
  type ContentCalendar,
} from "@/lib/contract-workspace";
import { AfghanDateField } from "@/components/shared/afghan-date-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type EditorRow = {
  key: string;
  topic: string;
  contentType: string;
  language: string;
  publishDate: string;
};

let rowSeq = 0;
const nextKey = () => `portal-row-${(rowSeq += 1)}`;

function emptyRow(previous?: EditorRow): EditorRow {
  let publishDate = "";
  if (previous?.publishDate) {
    const date = new Date(`${previous.publishDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    publishDate = date.toISOString().slice(0, 10);
  }
  return {
    key: nextKey(),
    topic: "",
    contentType: previous?.contentType || CONTENT_TYPE_OPTIONS[0],
    language: previous?.language || CONTENT_LANGUAGE_OPTIONS[0],
    publishDate,
  };
}

function toEditorRows(rows: CalendarRow[]): EditorRow[] {
  return rows.map((row) => ({
    key: nextKey(),
    topic: row.topic,
    contentType: row.contentType,
    language: row.language,
    publishDate: toDateInputValue(row.publishDate),
  }));
}

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function OptionSelect({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  label: string;
}) {
  const list = options.includes(value) || !value ? options : [value, ...options];
  return (
    <select
      aria-label={label}
      className={selectClass}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {list.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

export function PortalCalendarEditorDialog({
  contractId,
  calendar,
  open,
  onOpenChange,
  hasSharedPdf,
}: {
  contractId: string;
  calendar: ContentCalendar | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasSharedPdf?: boolean;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState<EditorRow[]>([]);

  useEffect(() => {
    if (!open || !calendar) return;
    setTitle(calendar.title);
    setRows(calendar.rows.length ? toEditorRows(calendar.rows) : [emptyRow()]);
  }, [open, calendar]);

  const full = rows.length >= CALENDAR_MAX_ROWS;

  const updateRow = (key: string, patch: Partial<EditorRow>) =>
    setRows((list) => list.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const save = useMutation({
    mutationFn: () => {
      if (!calendar) throw new Error("تقویم یافت نشد");
      if (!title.trim()) throw new Error("عنوان تقویم الزامی است.");
      if (!rows.length) throw new Error("حداقل یک ردیف لازم است.");
      const missing = rows.findIndex((row) => !row.topic.trim());
      if (missing >= 0) {
        throw new Error(`موضوع ردیف ${formatCount(missing + 1)} را وارد کنید.`);
      }
      return apiPut<ContentCalendar>(
        `/portal/contracts/${encodeURIComponent(contractId)}/calendars/${encodeURIComponent(calendar.id)}`,
        {
          title: title.trim(),
          rows: rows.map(({ topic, contentType, language, publishDate }) => ({
            topic: topic.trim(),
            contentType,
            language,
            publishDate: publishDate || null,
          })),
        },
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["portal-contract", contractId] });
      toast.success(
        hasSharedPdf
          ? "تقویم ذخیره شد. فایل PDF قبلی تا ارسال مجدد تیم اپکس به‌روز نمی‌شود."
          : "تقویم محتوایی به‌روزرسانی شد",
      );
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "ذخیره ناموفق بود");
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && save.isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent dir="rtl" className="flex max-h-[92vh] flex-col gap-4 text-start sm:max-w-5xl">
        <DialogHeader className="text-start sm:text-start">
          <DialogTitle>ویرایش تقویم محتوایی</DialogTitle>
          <DialogDescription>
            موضوع، نوع محتوا، زبان و تاریخ نشر را اصلاح کنید. حداکثر{" "}
            {formatCount(CALENDAR_MAX_ROWS)} ردیف مجاز است.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="portal-calendar-title">عنوان تقویم</Label>
          <Input
            id="portal-calendar-title"
            value={title}
            placeholder="مثلاً تقویم محتوایی ماه قوس"
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border/70">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
              <tr className="text-xs text-muted-foreground">
                <th className="w-14 px-2 py-2.5 text-center font-semibold">شماره</th>
                <th className="px-2 py-2.5 text-start font-semibold">موضوع</th>
                <th className="w-36 px-2 py-2.5 text-start font-semibold">نوعیت محتوا</th>
                <th className="w-36 px-2 py-2.5 text-start font-semibold">زبان</th>
                <th className="w-48 px-2 py-2.5 text-start font-semibold">تاریخ نشر</th>
                <th className="w-12 px-2 py-2.5" aria-label="حذف" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.key} className="border-t border-border/60">
                  <td className="px-2 py-1.5 text-center text-xs font-semibold tabular-nums text-muted-foreground">
                    {formatCount(index + 1)}
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      aria-label={`موضوع ردیف ${index + 1}`}
                      value={row.topic}
                      placeholder="مثلاً معرفی کمپنی"
                      onChange={(event) => updateRow(row.key, { topic: event.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <OptionSelect
                      label={`نوعیت محتوا ردیف ${index + 1}`}
                      value={row.contentType}
                      options={CONTENT_TYPE_OPTIONS}
                      onChange={(value) => updateRow(row.key, { contentType: value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <OptionSelect
                      label={`زبان ردیف ${index + 1}`}
                      value={row.language}
                      options={CONTENT_LANGUAGE_OPTIONS}
                      onChange={(value) => updateRow(row.key, { language: value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <AfghanDateField
                      aria-label={`تاریخ نشر ردیف ${index + 1}`}
                      value={row.publishDate}
                      onChange={(value) => updateRow(row.key, { publishDate: value })}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      aria-label={`حذف ردیف ${index + 1}`}
                      disabled={rows.length <= 1}
                      onClick={() => setRows((list) => list.filter((item) => item.key !== row.key))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={full || save.isPending}
            onClick={() => setRows((list) => [...list, emptyRow(list[list.length - 1])])}
          >
            <Plus className="h-4 w-4" />
            افزودن ردیف
            <span className="tabular-nums text-muted-foreground">
              ({formatCount(rows.length)}/{formatCount(CALENDAR_MAX_ROWS)})
            </span>
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              انصراف
            </Button>
            <Button variant="brand" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              ذخیره تغییرات
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
