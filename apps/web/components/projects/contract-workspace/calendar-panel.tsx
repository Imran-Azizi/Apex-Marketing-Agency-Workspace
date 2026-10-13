"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarDays,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiPost, apiPut } from "@/lib/api";
import { formatCount, toDateInputValue } from "@/lib/contract-project";
import {
  CALENDAR_MAX_ROWS,
  CONTENT_LANGUAGE_OPTIONS,
  CONTENT_TYPE_OPTIONS,
  type CalendarRow,
  type ContentCalendar,
  type ContractWorkspace,
} from "@/lib/contract-workspace";
import { CalendarTable } from "@/components/contract-content/calendar-table";
import { AfghanDateField } from "@/components/shared/afghan-date-field";
import { Badge } from "@/components/ui/badge";
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
import { CalendarShareMenu, ShareStatus } from "./share-menu";
import { PanelHeader } from "./panel-header";

type EditorRow = { key: string; topic: string; contentType: string; language: string; publishDate: string };

type EditorState = { calendar: ContentCalendar | null } | null;

let rowSeq = 0;
const nextKey = () => `row-${(rowSeq += 1)}`;

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

function CalendarEditorDialog({
  projectId,
  state,
  onClose,
}: {
  projectId: string;
  state: EditorState;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState<EditorRow[]>([]);
  const [current, setCurrent] = useState<EditorState>(null);
  if (state !== current) {
    setCurrent(state);
    if (state) {
      setTitle(state.calendar?.title || "");
      setRows(state.calendar ? toEditorRows(state.calendar.rows) : [emptyRow()]);
    }
  }
  const editingId = state?.calendar?.id;
  const full = rows.length >= CALENDAR_MAX_ROWS;

  const updateRow = (key: string, patch: Partial<EditorRow>) =>
    setRows((list) => list.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const save = useMutation({
    mutationFn: () => {
      if (!title.trim()) throw new Error("عنوان تقویم الزامی است.");
      if (!rows.length) throw new Error("حداقل یک ردیف لازم است.");
      const missing = rows.findIndex((row) => !row.topic.trim());
      if (missing >= 0) throw new Error(`موضوع ردیف ${formatCount(missing + 1)} را وارد کنید.`);
      const body = {
        title: title.trim(),
        rows: rows.map(({ topic, contentType, language, publishDate }) => ({
          topic: topic.trim(),
          contentType,
          language,
          publishDate: publishDate || null,
        })),
      };
      return editingId
        ? apiPut(`/projects/${projectId}/workspace/calendars/${editingId}`, body)
        : apiPost(`/projects/${projectId}/workspace/calendars`, body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contract-workspace", projectId] });
      toast.success(editingId ? "تقویم محتوایی به‌روزرسانی شد" : "تقویم محتوایی ایجاد شد");
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "ذخیره ناموفق بود");
    },
  });

  return (
    <Dialog
      open={Boolean(state)}
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose();
      }}
    >
      <DialogContent className="flex max-h-[92vh] flex-col gap-4 sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{editingId ? "ویرایش تقویم محتوایی" : "تقویم محتوایی جدید"}</DialogTitle>
          <DialogDescription>
            حداکثر {formatCount(CALENDAR_MAX_ROWS)} ردیف؛ تاریخ ردیف جدید یک روز بعد از ردیف قبلی پر می‌شود.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="calendar-title">عنوان تقویم</Label>
          <Input
            id="calendar-title"
            value={title}
            placeholder="مثلاً تقویم محتوایی ماه میزان"
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
            disabled={full}
            onClick={() => setRows((list) => [...list, emptyRow(list[list.length - 1])])}
          >
            <Plus className="h-4 w-4" />
            افزودن ردیف
            <span className="tabular-nums text-muted-foreground">
              ({formatCount(rows.length)}/{formatCount(CALENDAR_MAX_ROWS)})
            </span>
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={save.isPending}>
              انصراف
            </Button>
            <Button variant="brand" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              ذخیره تقویم
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CalendarPanel({
  projectId,
  contractTitle,
  contractCode,
  customerName,
  workspace,
  canEdit,
  customerWhatsapp,
}: {
  projectId: string;
  contractTitle: string;
  contractCode: string;
  customerName: string;
  workspace: ContractWorkspace;
  canEdit: boolean;
  customerWhatsapp: string | null;
}) {
  const pdfContext = { contractTitle, contractCode, customerName };
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<EditorState>(null);
  const [deleting, setDeleting] = useState<ContentCalendar | null>(null);
  const calendars = workspace.calendars;

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/projects/${projectId}/workspace/calendars/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contract-workspace", projectId] });
      toast.success("تقویم محتوایی حذف شد");
      setDeleting(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "حذف ناموفق بود");
    },
  });

  return (
    <div className="space-y-5">
      <PanelHeader
        icon={<CalendarDays className="h-5 w-5" />}
        title="تقویم محتوایی"
        actions={
          canEdit && calendars.length ? (
            <Button variant="brand" size="sm" className="rounded-xl" onClick={() => setEditor({ calendar: null })}>
              <Plus className="h-4 w-4" />
              تقویم جدید
            </Button>
          ) : null
        }
      />

      {calendars.length ? (
        <div className="space-y-6">
          {calendars.map((calendar) => (
            <section key={calendar.id} className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold sm:text-base">{calendar.title}</h3>
                    <Badge variant="secondary" className="tabular-nums">
                      {formatCount(calendar.rows.length)}/{formatCount(CALENDAR_MAX_ROWS)} ردیف
                    </Badge>
                  </div>
                  <ShareStatus
                    share={workspace.shares.calendars[calendar.id]}
                    updatedAt={calendar.updatedAt}
                  />
                </div>
                {canEdit ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => setEditor({ calendar })}
                    >
                      <Pencil className="h-4 w-4" />
                      ویرایش
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-destructive hover:text-destructive"
                      onClick={() => setDeleting(calendar)}
                    >
                      <Trash2 className="h-4 w-4" />
                      حذف
                    </Button>
                    <CalendarShareMenu
                      projectId={projectId}
                      calendar={calendar}
                      context={pdfContext}
                      customerWhatsapp={customerWhatsapp}
                      hasPortalAccount={workspace.hasPortalAccount}
                    />
                  </div>
                ) : null}
              </div>
              <CalendarTable rows={calendar.rows} />
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-10 text-center">
          <p className="font-semibold">هنوز تقویم محتوایی ساخته نشده</p>
          {canEdit ? (
            <Button variant="brand" className="mt-4 rounded-xl" onClick={() => setEditor({ calendar: null })}>
              <Plus className="h-4 w-4" />
              ایجاد تقویم محتوایی
            </Button>
          ) : null}
        </div>
      )}

      {canEdit ? (
        <>
          <CalendarEditorDialog projectId={projectId} state={editor} onClose={() => setEditor(null)} />
          <Dialog
            open={Boolean(deleting)}
            onOpenChange={(open) => {
              if (!open && !remove.isPending) setDeleting(null);
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <DialogTitle>حذف تقویم محتوایی</DialogTitle>
                <DialogDescription>
                  «{deleting?.title}» حذف شود؟ اگر برای مشتری ارسال شده باشد، از پورتال او هم برداشته می‌شود.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setDeleting(null)} disabled={remove.isPending}>
                  انصراف
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleting && remove.mutate(deleting.id)}
                  disabled={remove.isPending}
                >
                  {remove.isPending ? "در حال حذف..." : "بله، حذف شود"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}
