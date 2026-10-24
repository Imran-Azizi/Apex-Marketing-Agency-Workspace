"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { formatDateTime, cn } from "@/lib/utils";
import { useHasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingTable } from "@/components/shared/loading-table";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TaskStatsCards } from "./_components/task-stats";
import { TaskFormDialog } from "./_components/task-form-dialog";
import {
  PRIORITY_BADGE_VARIANTS,
  PRIORITY_LABELS,
  STATUS_BADGE_VARIANTS,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskListResponse,
  type TaskPriority,
  type TaskStats,
  type TaskStatus,
  type TaskUserBrief,
} from "./_components/types";

const PAGE_SIZE = 20;
const ALL = "ALL";

type SortField = "deadline" | "createdAt" | "priority" | "status";

export default function TasksPage() {
  const router = useRouter();
  const canCreate = useHasPermission("tasks.create");
  const canManage = useHasPermission("tasks.manage");
  const canEdit = useHasPermission(["tasks.edit", "tasks.create"]);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [priority, setPriority] = useState(ALL);
  const [assigneeId, setAssigneeId] = useState(ALL);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sort, setSort] = useState<SortField>("deadline");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [statFilter, setStatFilter] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!statFilter) return;
    if (statFilter === "overdue") {
      setOverdueOnly(true);
      setStatus(ALL);
    } else if (statFilter === "pending") {
      setOverdueOnly(false);
      setStatus("PENDING");
    } else if (statFilter === "inProgress") {
      setOverdueOnly(false);
      setStatus("IN_PROGRESS");
    } else if (statFilter === "completed") {
      setOverdueOnly(false);
      setStatus("COMPLETED");
    } else if (statFilter === "approved") {
      setOverdueOnly(false);
      setStatus("APPROVED");
    } else if (statFilter === "total") {
      setOverdueOnly(false);
      setStatus(ALL);
    }
    setPage(1);
  }, [statFilter]);

  const listParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    params.set("sort", sort);
    params.set("order", order);
    if (search) params.set("q", search);
    if (status !== ALL) params.set("status", status);
    if (priority !== ALL) params.set("priority", priority);
    if (assigneeId !== ALL) params.set("assigneeId", assigneeId);
    if (overdueOnly) params.set("overdue", "true");
    return params.toString();
  }, [page, search, status, priority, assigneeId, overdueOnly, sort, order]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["tasks", "stats"],
    queryFn: () => apiGet<TaskStats>("/tasks/stats"),
  });

  const { data: assignees } = useQuery({
    queryKey: ["tasks", "assignees"],
    queryFn: () => apiGet<TaskUserBrief[]>("/tasks/assignees"),
    enabled: canCreate || canEdit || canManage,
  });

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["tasks", "list", listParams],
    queryFn: () => apiGet<TaskListResponse>(`/tasks?${listParams}`),
    placeholderData: keepPreviousData,
  });

  const activeDropdownFilters =
    (status !== ALL ? 1 : 0) +
    (priority !== ALL ? 1 : 0) +
    (assigneeId !== ALL ? 1 : 0) +
    (overdueOnly ? 1 : 0);
  const hasFilters =
    search !== "" || status !== ALL || priority !== ALL || assigneeId !== ALL || overdueOnly;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatus(ALL);
    setPriority(ALL);
    setAssigneeId(ALL);
    setOverdueOnly(false);
    setStatFilter(null);
    setPage(1);
  };

  const openCreate = () => setFormOpen(true);

  function renderSearchField(className?: string) {
    return (
      <div className={`relative min-w-0 flex-1 ${className ?? "sm:max-w-sm"}`}>
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="جستجو در عنوان یا توضیحات…"
          className="ps-9"
        />
      </div>
    );
  }

  function renderStatusSelect(className?: string) {
    return (
      <Select
        value={status}
        onValueChange={(value) => {
          setStatus(value);
          setStatFilter(null);
          setPage(1);
        }}
      >
        <SelectTrigger className={className ?? "w-full sm:w-44"}>
          <SelectValue placeholder="وضعیت" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>همه وضعیت‌ها</SelectItem>
          {TASK_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  function renderPrioritySelect(className?: string) {
    return (
      <Select
        value={priority}
        onValueChange={(value) => {
          setPriority(value);
          setPage(1);
        }}
      >
        <SelectTrigger className={className ?? "w-full sm:w-36"}>
          <SelectValue placeholder="اولویت" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>همه اولویت‌ها</SelectItem>
          {TASK_PRIORITIES.map((p) => (
            <SelectItem key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  function renderAssigneeSelect(className?: string) {
    if (!assignees?.length) return null;
    return (
      <Select
        value={assigneeId}
        onValueChange={(value) => {
          setAssigneeId(value);
          setPage(1);
        }}
      >
        <SelectTrigger className={className ?? "w-full sm:w-44"}>
          <SelectValue placeholder="کارمند" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>همه کارمندان</SelectItem>
          {assignees.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.fullName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="space-y-6 text-start" dir="rtl">
      <PageHeader
        title="مدیریت وظایف"
        subtitle="ایجاد، تخصیص و پیگیری وظایف کارمندان با مهلت و اولویت"
        actions={
          canCreate ? (
            <Button variant="brand" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              وظیفه جدید
            </Button>
          ) : null
        }
      />

      <TaskStatsCards
        stats={stats}
        loading={statsLoading}
        activeKey={statFilter}
        onSelect={setStatFilter}
      />

      {canManage && stats?.byAssignee?.length ? (
        <div className="rounded-2xl border border-border/70 bg-card p-4 text-start">
          <p className="mb-3 text-sm font-medium text-foreground">
            گروه‌بندی بر اساس کارمند
          </p>
          <div className="flex flex-wrap justify-start gap-2">
            {stats.byAssignee.slice(0, 12).map((row) => (
              <button
                key={row.assigneeId}
                type="button"
                onClick={() => {
                  setAssigneeId(row.assigneeId);
                  setPage(1);
                }}
                className={cn(
                  "inline-flex items-center justify-start gap-2 rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs transition-colors",
                  assigneeId === row.assigneeId && "border-brand/40 bg-brand/5",
                )}
              >
                <UserAvatar
                  name={row.fullName}
                  profileImage={row.profileImage}
                  className="h-6 w-6"
                />
                <span>{row.fullName}</span>
                <Badge variant="secondary" className="h-5 px-1.5 tabular-nums">
                  {row.count}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border/70 bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {renderSearchField()}
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            {renderStatusSelect()}
            {renderPrioritySelect()}
            {renderAssigneeSelect()}
            <Select
              value={`${sort}:${order}`}
              onValueChange={(value) => {
                const [s, o] = value.split(":") as [SortField, "asc" | "desc"];
                setSort(s);
                setOrder(o);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="مرتب‌سازی" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deadline:asc">مهلت (نزدیک‌ترین)</SelectItem>
                <SelectItem value="deadline:desc">مهلت (دورترین)</SelectItem>
                <SelectItem value="createdAt:desc">جدیدترین</SelectItem>
                <SelectItem value="createdAt:asc">قدیمی‌ترین</SelectItem>
                <SelectItem value="priority:desc">اولویت (بالا)</SelectItem>
                <SelectItem value="status:asc">وضعیت</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4" />
                پاک کردن
              </Button>
            )}
          </div>
          <Button
            variant="outline"
            className="md:hidden"
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            فیلترها
            {activeDropdownFilters > 0 ? (
              <Badge className="me-0 ms-1" variant="brand">
                {activeDropdownFilters}
              </Badge>
            ) : null}
          </Button>
        </div>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl" dir="rtl">
          <SheetHeader className="text-start">
            <SheetTitle>فیلتر وظایف</SheetTitle>
            <SheetDescription>وضعیت، اولویت و کارمند را محدود کنید.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {renderStatusSelect("w-full")}
            {renderPrioritySelect("w-full")}
            {renderAssigneeSelect("w-full")}
          </div>
          <SheetFooter className="mt-6 gap-2 sm:justify-start">
            <Button variant="outline" onClick={clearFilters}>
              پاک کردن
            </Button>
            <Button variant="brand" onClick={() => setFiltersOpen(false)}>
              اعمال
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <div className="rounded-2xl border border-border/70 bg-card overflow-hidden">
        {isLoading ? (
          <LoadingTable columns={6} rows={8} />
        ) : error ? (
          <div className="p-8 text-center text-sm text-destructive">
            خطا در بارگذاری وظایف
          </div>
        ) : !data?.items?.length ? (
          <EmptyState
            title="وظیفه‌ای یافت نشد"
            description={
              hasFilters
                ? "فیلترها را تغییر دهید یا پاک کنید."
                : canCreate
                  ? "اولین وظیفه را ایجاد و به کارمند تخصیص دهید."
                  : "هنوز وظیفه‌ای به شما محول نشده است."
            }
            action={
              canCreate ? (
                <Button variant="brand" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  وظیفه جدید
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table dir="rtl">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">عنوان</TableHead>
                  <TableHead className="text-start">مسئول</TableHead>
                  <TableHead className="text-start">اولویت</TableHead>
                  <TableHead className="text-start">وضعیت</TableHead>
                  <TableHead className="text-start">مهلت</TableHead>
                  <TableHead className="text-start">ایجاد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((task) => (
                  <TableRow
                    key={task.id}
                    className={cn(
                      "cursor-pointer",
                      isFetching && "opacity-70",
                      task.isOverdue && "bg-destructive/5",
                    )}
                    onClick={() => router.push(`/tasks/${task.id}`)}
                  >
                    <TableCell className="max-w-[16rem] text-start">
                      <div className="space-y-1 text-start">
                        <Link
                          href={`/tasks/${task.id}`}
                          className="font-medium text-foreground hover:text-brand"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {task.title}
                        </Link>
                        {task.isOverdue ? (
                          <span className="inline-flex items-center justify-start gap-1 text-[11px] text-destructive">
                            <AlertTriangle className="h-3 w-3" />
                            گذشته از مهلت
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-start">
                      <div className="flex items-center justify-start gap-2">
                        <UserAvatar
                          name={task.assignee?.fullName || "—"}
                          profileImage={task.assignee?.profileImage}
                          className="h-8 w-8"
                        />
                        <span className="text-sm">
                          {task.assignee?.fullName || "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-start">
                      <Badge
                        variant={
                          PRIORITY_BADGE_VARIANTS[task.priority as TaskPriority]
                        }
                      >
                        {PRIORITY_LABELS[task.priority as TaskPriority]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-start">
                      <Badge
                        variant={
                          STATUS_BADGE_VARIANTS[task.status as TaskStatus]
                        }
                      >
                        {STATUS_LABELS[task.status as TaskStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-start text-sm tabular-nums">
                      {formatDateTime(task.deadline)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-start text-sm text-muted-foreground tabular-nums">
                      {formatDateTime(task.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between gap-3 border-t border-border/70 px-4 py-3">
              <p className="text-start text-xs text-muted-foreground">
                صفحه {page} از {totalPages} · {data.total} وظیفه
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="صفحه قبل"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="صفحه بعد"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <TaskFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
