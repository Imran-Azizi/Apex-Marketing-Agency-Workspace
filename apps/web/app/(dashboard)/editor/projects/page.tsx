"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Clapperboard,
  Clock3,
  LayoutGrid,
  List,
  Search,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import {
  EDITING_PRIORITY_LABEL,
  EDITING_STATUS_LABEL,
  editingActionLabel,
  editingPriorityVariant,
  editingStatusVariant,
  type EditorTaskSummary,
} from "@/lib/editor";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ProjectProgressBar } from "@/components/projects/project-progress-bar";
import { getProjectStatusLabel } from "@/lib/project-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALERT_CALLOUT,
  ALERT_CARD_BORDER,
  ALERT_ICON,
} from "@/lib/theme-tones";

type ProjectsResponse = {
  items: EditorTaskSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

const STATUS_OPTIONS = [
  { value: "all", label: "همه وضعیت‌ها" },
  { value: "new", label: "ارجاع جدید" },
  { value: "in_progress", label: "در حال ادیت" },
  { value: "submitted", label: "ارسال‌شده" },
  { value: "revision", label: "نیاز به اصلاح" },
  { value: "completed", label: "تأیید / تکمیل‌شده" },
];

const DATE_OPTIONS = [
  { value: "all", label: "همه تاریخ‌ها" },
  { value: "today", label: "امروز" },
  { value: "week", label: "این هفته" },
  { value: "month", label: "این ماه" },
  { value: "custom", label: "بازه سفارشی" },
];

const PRIORITY_OPTIONS = [
  { value: "all", label: "همه اولویت‌ها" },
  { value: "high", label: "فوری / مهلت گذشته" },
  { value: "medium", label: "متوسط" },
  { value: "low", label: "عادی" },
];

function TaskCard({ task }: { task: EditorTaskSummary }) {
  return (
    <article
      className={cn(
        "flex h-full flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-all hover:border-brand/35 hover:shadow-md",
        task.status === "REVISION_REQUESTED"
          ? ALERT_CARD_BORDER
          : task.overdue
            ? "border-destructive/30"
            : "border-border/70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h3 className="line-clamp-2 font-semibold leading-7 text-foreground">
            {task.title}
          </h3>
          {task.instructionsPreview && (
            <p className="line-clamp-2 text-xs leading-6 text-muted-foreground">
              {task.instructionsPreview}
            </p>
          )}
        </div>
        <Badge
          variant={editingStatusVariant(task.status)}
          className="shrink-0 font-normal"
        >
          {EDITING_STATUS_LABEL[task.status] || task.status}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {task.assignedAt && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-muted/50 px-2 py-1">
            <CalendarClock className="h-3 w-3" />
            ارجاع: {formatDate(task.assignedAt)}
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-lg bg-muted/50 px-2 py-1">
          <Clock3 className="h-3 w-3" />
          مهلت: {task.deadline ? formatDate(task.deadline) : "—"}
        </span>
        <Badge
          variant={editingPriorityVariant(task.priority)}
          className="font-normal"
        >
          {EDITING_PRIORITY_LABEL[task.priority || "NORMAL"]}
        </Badge>
      </div>

      {task.status === "REVISION_REQUESTED" && task.revisionNotes && (
        <div className={cn("flex gap-2 px-3 py-2 text-xs leading-6", ALERT_CALLOUT)}>
          <AlertTriangle className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", ALERT_ICON)} />
          <span className="line-clamp-3">{task.revisionNotes}</span>
        </div>
      )}

      <ProjectProgressBar
        progress={task.progress}
        status={task.projectStatus}
        variant="compact"
      />

      <Button variant="brand" className="mt-auto gap-2" asChild>
        <Link href={`/editor/tasks/${task.projectId}`}>
          <Clapperboard className="h-4 w-4" />
          {editingActionLabel(task.status)}
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </article>
  );
}

export default function EditorProjectsPage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [date, setDate] = useState("all");
  const [priority, setPriority] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"grid" | "list">("grid");

  const queryKey = useMemo(
    () => [
      "editor-projects",
      search,
      status,
      date,
      priority,
      from,
      to,
      page,
    ],
    [search, status, date, priority, from, to, page],
  );

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "12",
        status,
        date,
        priority,
      });
      if (search) params.set("q", search);
      if (date === "custom") {
        if (from) params.set("from", from);
        if (to) params.set("to", to);
      }
      return apiGet<ProjectsResponse>(`/production/projects?${params.toString()}`);
    },
  });

  const applySearch = () => {
    setPage(1);
    setSearch(q.trim());
  };

  const items = data?.items || [];

  return (
    <div className="space-y-6 animate-fade-slide" dir="rtl">
      <PageHeader
        title="پروژه‌های ادیت"
        subtitle="فقط پروژه‌هایی که مدیر به شما ارجاع داده — بدون اطلاعات محرمانه یا پرداخت"
        actions={
          <Button variant="outline" className="gap-2" asChild>
            <Link href="/editor/dashboard">بازگشت به داشبورد</Link>
          </Button>
        }
      />

      <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="editor-search">جستجو</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="editor-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applySearch();
                }}
                placeholder="عنوان پروژه، دستورالعمل یا وضعیت…"
                className="h-11 ps-10"
              />
            </div>
          </div>
          <Button variant="brand" className="h-11" onClick={applySearch}>
            جستجو
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-1.5">
            <Label>وضعیت</Label>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>تاریخ ارجاع</Label>
            <Select
              value={date}
              onValueChange={(v) => {
                setDate(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>اولویت</Label>
            <Select
              value={priority}
              onValueChange={(v) => {
                setPriority(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>نمایش</Label>
            <div className="flex h-10 items-center gap-1 rounded-md border border-input p-1">
              <Button
                type="button"
                variant={view === "grid" ? "brand" : "ghost"}
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => setView("grid")}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                کارت
              </Button>
              <Button
                type="button"
                variant={view === "list" ? "brand" : "ghost"}
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => setView("list")}
              >
                <List className="h-3.5 w-3.5" />
                فهرست
              </Button>
            </div>
          </div>
        </div>

        {date === "custom" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="from-date">از تاریخ</Label>
              <Input
                id="from-date"
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to-date">تا تاریخ</Label>
              <Input
                id="to-date"
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        )}
      </section>

      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <p>
          {data
            ? `${data.total.toLocaleString("fa-AF", { numberingSystem: "latn" })} پروژه`
            : "—"}
          {isFetching && !isLoading ? " · در حال به‌روزرسانی…" : ""}
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <EmptyState title="بارگذاری پروژه‌ها ناموفق بود" />
      ) : items.length === 0 ? (
        <EmptyState
          title="نتیجه‌ای یافت نشد"
          description="فیلترها را تغییر دهید یا منتظر ارجاع پروژه جدید توسط مدیر بمانید."
        />
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="hidden grid-cols-[1.4fr_1fr_auto_auto_auto] gap-3 border-b bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground md:grid">
            <span>عنوان</span>
            <span>دستورالعمل</span>
            <span>وضعیت</span>
            <span>مهلت</span>
            <span>عملیات</span>
          </div>
          <ul className="divide-y divide-border/60">
            {items.map((task) => (
              <li
                key={task.id}
                className="grid gap-3 px-4 py-3 md:grid-cols-[1.4fr_1fr_auto_auto_auto] md:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{task.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground md:hidden">
                    {task.deadline ? formatDate(task.deadline) : "بدون مهلت"}
                  </p>
                </div>
                <p className="line-clamp-2 text-xs leading-6 text-muted-foreground">
                  {task.instructionsPreview || "—"}
                </p>
                <Badge
                  variant={editingStatusVariant(task.status)}
                  className="w-fit font-normal"
                >
                  {EDITING_STATUS_LABEL[task.status] || task.status}
                </Badge>
                <span className="hidden text-sm tabular-nums text-muted-foreground md:inline">
                  {task.deadline ? formatDate(task.deadline) : "—"}
                </span>
                <Button variant="brand" size="sm" className="w-fit gap-1.5" asChild>
                  <Link href={`/editor/tasks/${task.projectId}`}>
                    {editingActionLabel(task.status)}
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            قبلی
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            صفحه {page.toLocaleString("fa-AF", { numberingSystem: "latn" })} از{" "}
            {data.totalPages.toLocaleString("fa-AF", { numberingSystem: "latn" })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!data.hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            بعدی
          </Button>
        </div>
      )}
    </div>
  );
}
