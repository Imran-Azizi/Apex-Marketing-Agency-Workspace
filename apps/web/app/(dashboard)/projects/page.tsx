"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiGet, apiDelete } from "@/lib/api";
import { toEnglishDigits } from "@/lib/utils";
import { getMe } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PageHeader } from "@/components/shared/page-header";
import { HorizontalScroll } from "@/components/shared/horizontal-scroll";
import { LoadingTable } from "@/components/shared/loading-table";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, PlusCircle, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  DELIVERY_STATUS_FILTER_OPTIONS,
  getDeliveryStatusLabel,
  getProjectStatusLabel,
} from "@/lib/project-status";
import { ProjectProgressBar } from "@/components/projects/project-progress-bar";
import { TablePagination } from "@/components/shared/table-pagination";
import type { ProjectProgress } from "@/lib/project-progress";

const ALL = "ALL";
const PAGE_SIZE = 15;

const DATE_PRESET_OPTIONS = [
  { value: ALL, label: "همه تاریخ‌ها" },
  { value: "today", label: "امروز" },
  { value: "week", label: "۷ روز اخیر" },
  { value: "month", label: "این ماه" },
  { value: "custom", label: "بازه سفارشی" },
] as const;

interface AssignmentRecord {
  role: string;
  teamProfile?: { displayName?: string | null; userId?: string | null };
  user?: {
    id?: string;
    fullName?: string | null;
    profileImage?: string | null;
  };
}

interface Project {
  id: string;
  code: string;
  title: string;
  status: string;
  customerFacingStatus: string;
  deliveryStatus?: string | null;
  progress?: ProjectProgress | number | null;
  crmCustomer: {
    id?: string;
    personName: string;
    companyName: string | null;
  };
  assignments?: AssignmentRecord[];
}

interface ProjectListResponse {
  items: Project[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ProjectFilterOptions {
  customers: Array<{
    id: string;
    personName: string;
    companyName: string | null;
  }>;
  editors: Array<{ id: string; fullName: string; profileImage?: string | null }>;
}

type ActiveChip = {
  key: string;
  label: string;
  onClear: () => void;
};

function getAssignedPerson(project: Project, role: "EDITOR" | "NARRATOR") {
  const assignment = project.assignments?.find((item) => item.role === role);
  if (!assignment) return null;
  const name =
    assignment.teamProfile?.displayName || assignment.user?.fullName || null;
  if (!name) return null;
  return {
    name,
    profileImage: assignment.user?.profileImage || null,
  };
}

function customerLabel(customer: {
  personName: string;
  companyName: string | null;
}) {
  return customer.companyName
    ? `${customer.personName} — ${customer.companyName}`
    : customer.personName;
}

export default function ProjectsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState(ALL);
  const [editorId, setEditorId] = useState(ALL);
  const [deliveryStatus, setDeliveryStatus] = useState(ALL);
  const [createdPreset, setCreatedPreset] = useState(ALL);
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(toEnglishDigits(searchInput).trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const listParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    if (search) params.set("q", search);
    if (customerId !== ALL) params.set("customerId", customerId);
    if (editorId !== ALL) params.set("editorId", editorId);
    if (deliveryStatus !== ALL) params.set("deliveryStatus", deliveryStatus);
    if (createdPreset !== ALL) params.set("createdPreset", createdPreset);
    if (createdPreset === "custom") {
      if (createdFrom) params.set("createdFrom", createdFrom);
      if (createdTo) params.set("createdTo", createdTo);
    }
    return params.toString();
  }, [
    page,
    search,
    customerId,
    editorId,
    deliveryStatus,
    createdPreset,
    createdFrom,
    createdTo,
  ]);

  const filterKey = useMemo(
    () => ({
      search,
      customerId,
      editorId,
      deliveryStatus,
      createdPreset,
      createdFrom,
      createdTo,
      page,
      pageSize: PAGE_SIZE,
    }),
    [
      search,
      customerId,
      editorId,
      deliveryStatus,
      createdPreset,
      createdFrom,
      createdTo,
      page,
    ],
  );

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["projects", filterKey],
    queryFn: () => apiGet<ProjectListResponse>(`/projects?${listParams}`),
    placeholderData: keepPreviousData,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize || PAGE_SIZE;
  const totalPages = data
    ? data.totalPages || Math.max(1, Math.ceil(total / pageSize))
    : 1;

  // After delete/filter, avoid staying on an empty trailing page.
  useEffect(() => {
    if (!data) return;
    if (page > totalPages) setPage(totalPages);
  }, [data, page, totalPages]);

  const { data: filterOptions } = useQuery({
    queryKey: ["projects", "filter-options"],
    queryFn: () => apiGet<ProjectFilterOptions>("/projects/filter-options"),
    staleTime: 5 * 60 * 1000,
  });

  const { data: me } = useQuery({
    queryKey: ["me", "internal"],
    queryFn: getMe,
    retry: false,
  });
  const canDeleteProject = hasPermission(
    me?.permissions,
    "projects.delete",
    me?.role,
  );
  const canCreateProject = hasPermission(
    me?.permissions,
    "projects.create",
    me?.role,
  );
  const canViewProjects = hasPermission(
    me?.permissions,
    "projects.view",
    me?.role,
  );

  useEffect(() => {
    if (!me?.role) return;
    if (canViewProjects) return;
    if (me.role === "NARRATOR") {
      router.replace("/narrator/dashboard");
    }
    if (me.role === "EDITOR") {
      router.replace("/editor/dashboard");
    }
    if (me.role === "PROJECT_MANAGER") {
      router.replace("/project-manager/dashboard");
    }
  }, [me, router, canViewProjects]);

  const deleteProject = useMutation({
    mutationFn: (id: string) => apiDelete(`/projects/${id}`),
    onSuccess: () => {
      toast.success("پروژه و تمام سوابق پرداخت مرتبط حذف شد");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project"] });
      queryClient.invalidateQueries({ queryKey: ["crm-customers"] });
      queryClient.invalidateQueries({ queryKey: ["crm-customer"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setDeleteOpen(false);
      setDeletingProject(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "حذف پروژه ناموفق بود");
    },
  });

  const activeDropdownFilters =
    (customerId !== ALL ? 1 : 0) +
    (editorId !== ALL ? 1 : 0) +
    (deliveryStatus !== ALL ? 1 : 0) +
    (createdPreset !== ALL ? 1 : 0);

  const hasActiveFilters = search !== "" || activeDropdownFilters > 0;

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setCustomerId(ALL);
    setEditorId(ALL);
    setDeliveryStatus(ALL);
    setCreatedPreset(ALL);
    setCreatedFrom("");
    setCreatedTo("");
    setPage(1);
  };

  const clearDropdownFilters = () => {
    setCustomerId(ALL);
    setEditorId(ALL);
    setDeliveryStatus(ALL);
    setCreatedPreset(ALL);
    setCreatedFrom("");
    setCreatedTo("");
    setPage(1);
  };

  const setCustomerFilter = (value: string) => {
    setCustomerId(value);
    setPage(1);
  };

  const setEditorFilter = (value: string) => {
    setEditorId(value);
    setPage(1);
  };

  const setDeliveryFilter = (value: string) => {
    setDeliveryStatus(value);
    setPage(1);
  };

  const setCreatedPresetFilter = (value: string) => {
    setCreatedPreset(value);
    setPage(1);
    if (value !== "custom") {
      setCreatedFrom("");
      setCreatedTo("");
    }
  };

  const selectedCustomer = filterOptions?.customers.find(
    (c) => c.id === customerId,
  );
  const selectedEditor = filterOptions?.editors.find((e) => e.id === editorId);
  const selectedDatePreset = DATE_PRESET_OPTIONS.find(
    (o) => o.value === createdPreset,
  );

  const activeChips = useMemo(() => {
    const chips: ActiveChip[] = [];
    if (search) {
      chips.push({
        key: "search",
        label: `جستجو: ${search}`,
        onClear: () => {
          setSearchInput("");
          setSearch("");
          setPage(1);
        },
      });
    }
    if (customerId !== ALL && selectedCustomer) {
      chips.push({
        key: "customer",
        label: `مشتری: ${selectedCustomer.personName}`,
        onClear: () => setCustomerFilter(ALL),
      });
    } else if (customerId !== ALL) {
      chips.push({
        key: "customer",
        label: "مشتری: انتخاب‌شده",
        onClear: () => setCustomerFilter(ALL),
      });
    }
    if (editorId !== ALL && selectedEditor) {
      chips.push({
        key: "editor",
        label: `ویرایشگر: ${selectedEditor.fullName}`,
        onClear: () => setEditorFilter(ALL),
      });
    } else if (editorId !== ALL) {
      chips.push({
        key: "editor",
        label: "ویرایشگر: انتخاب‌شده",
        onClear: () => setEditorFilter(ALL),
      });
    }
    if (deliveryStatus !== ALL) {
      chips.push({
        key: "delivery",
        label: `تحویل: ${getDeliveryStatusLabel(deliveryStatus)}`,
        onClear: () => setDeliveryFilter(ALL),
      });
    }
    if (createdPreset !== ALL) {
      let dateLabel = selectedDatePreset?.label || "تاریخ";
      if (createdPreset === "custom") {
        const fromLabel = createdFrom || "…";
        const toLabel = createdTo || "…";
        dateLabel = `از ${fromLabel} تا ${toLabel}`;
      }
      chips.push({
        key: "created",
        label: `ایجاد: ${dateLabel}`,
        onClear: () => setCreatedPresetFilter(ALL),
      });
    }
    return chips;
  }, [
    search,
    customerId,
    editorId,
    deliveryStatus,
    createdPreset,
    createdFrom,
    createdTo,
    selectedCustomer,
    selectedEditor,
    selectedDatePreset,
  ]);

  const openDelete = (project: Project) => {
    setDeletingProject(project);
    setDeleteOpen(true);
  };

  const openProject = (projectId: string) => {
    router.push(`/projects/${projectId}`);
  };

  const resultCount = total;
  const showEmptyCatalog = Boolean(data && total === 0 && !hasActiveFilters);
  const showEmptyFiltered = Boolean(data && total === 0 && hasActiveFilters);

  return (
    <div className="min-w-0">
      <PageHeader
        inline
        title="پروژه‌ها"
        subtitle="لیست پروژه‌های فعال و تکمیل‌شده"
        actions={
          canCreateProject ? (
            <Button
              type="button"
              variant="brand"
              size="default"
              className="rounded-xl shadow-md shadow-brand/20"
              onClick={() => router.push("/projects/new")}
            >
              <PlusCircle className="h-4 w-4" />
              ایجاد پروژه جدید
            </Button>
          ) : null
        }
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle>حذف پروژه</DialogTitle>
            <DialogDescription>
              آیا از حذف پروژه «{deletingProject?.code} —{" "}
              {deletingProject?.title}» مطمئن هستید؟ این عملیات پروژه را از
              مدیریت پروژه، پرونده مشتری، پورتال و داشبورد حذف می‌کند و تمام
              فاکتورها و پرداخت‌های مرتبط نیز پاک می‌شوند. این عمل قابل بازگشت
              نیست.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteProject.isPending}
            >
              انصراف
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deletingProject && deleteProject.mutate(deletingProject.id)
              }
              disabled={deleteProject.isPending || !deletingProject}
            >
              {deleteProject.isPending ? "در حال حذف..." : "بله، حذف شود"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        <div className="-mx-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:thin]">
          <div className="flex min-w-max items-center gap-2">
            <div className="relative w-[min(20rem,55vw)] shrink-0 sm:w-[18rem] lg:w-[20rem]">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="جستجو: پروژه، مشتری، شرکت یا شناسه…"
                className="h-10 ps-9 pe-9"
                aria-label="جستجوی پروژه‌ها"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                    setPage(1);
                  }}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title="پاک کردن جستجو"
                  aria-label="پاک کردن جستجو"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <Select value={customerId} onValueChange={setCustomerFilter}>
              <SelectTrigger
                className="h-10 w-[10.5rem] shrink-0"
                aria-label="فیلتر مشتری"
              >
                <SelectValue placeholder="مشتری" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>همه مشتریان</SelectItem>
                {(filterOptions?.customers ?? []).map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customerLabel(customer)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={editorId} onValueChange={setEditorFilter}>
              <SelectTrigger
                className="h-10 w-[10rem] shrink-0"
                aria-label="فیلتر ویرایشگر"
              >
                <SelectValue placeholder="ویرایشگر" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>همه ویرایشگرها</SelectItem>
                {(filterOptions?.editors ?? []).map((editor) => (
                  <SelectItem key={editor.id} value={editor.id}>
                    {editor.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={deliveryStatus} onValueChange={setDeliveryFilter}>
              <SelectTrigger
                className="h-10 w-[10rem] shrink-0"
                aria-label="فیلتر وضعیت تحویل"
              >
                <SelectValue placeholder="تحویل" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>همه وضعیت‌های تحویل</SelectItem>
                {DELIVERY_STATUS_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={createdPreset} onValueChange={setCreatedPresetFilter}>
              <SelectTrigger
                className="h-10 w-[9.5rem] shrink-0"
                aria-label="فیلتر تاریخ ایجاد"
              >
                <SelectValue placeholder="تاریخ ایجاد" />
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESET_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {createdPreset === "custom" && (
              <>
                <Input
                  type="date"
                  value={createdFrom}
                  onChange={(e) => {
                    setCreatedFrom(e.target.value);
                    setPage(1);
                  }}
                  className="h-10 w-[9.5rem] shrink-0"
                  dir="ltr"
                  aria-label="از تاریخ"
                />
                <Input
                  type="date"
                  value={createdTo}
                  onChange={(e) => {
                    setCreatedTo(e.target.value);
                    setPage(1);
                  }}
                  className="h-10 w-[9.5rem] shrink-0"
                  dir="ltr"
                  aria-label="تا تاریخ"
                />
              </>
            )}

            {activeDropdownFilters > 0 && (
              <Button
                type="button"
                variant="ghost"
                className="h-10 shrink-0 gap-1.5 px-3 text-muted-foreground"
                onClick={clearDropdownFilters}
              >
                <X className="h-4 w-4" />
                پاک کردن فیلترها
              </Button>
            )}
          </div>
        </div>

        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.onClear}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/80 bg-muted/50 px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-muted"
                title="حذف این فیلتر"
              >
                <span className="truncate">{chip.label}</span>
                <X className="h-3 w-3 shrink-0 text-muted-foreground" />
              </button>
            ))}
            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                onClick={clearFilters}
              >
                <X className="h-3.5 w-3.5" />
                پاک کردن همه
              </Button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <p>
            {data
              ? `${resultCount.toLocaleString("fa-AF", {
                  numberingSystem: "latn",
                })} پروژه`
              : "—"}
            {isFetching && !isLoading ? " · در حال به‌روزرسانی…" : ""}
          </p>
        </div>

        {isLoading && <LoadingTable columns={canDeleteProject ? 8 : 7} />}

        {error && (
          <EmptyState
            title="بارگذاری پروژه‌ها ناموفق بود"
            description="لطفاً اتصال خود را بررسی کرده و دوباره تلاش کنید."
          />
        )}

        {showEmptyCatalog && (
          <EmptyState
            title="پروژه‌ای ثبت نشده است"
            description="اولین پروژه را برای یکی از مشتریان موجود ایجاد کنید."
            action={
              canCreateProject ? (
                <Button
                  type="button"
                  variant="brand"
                  className="rounded-xl"
                  onClick={() => router.push("/projects/new")}
                >
                  <PlusCircle className="h-4 w-4" />
                  ایجاد پروژه جدید
                </Button>
              ) : undefined
            }
          />
        )}

        {showEmptyFiltered && (
          <EmptyState
            title="نتیجه‌ای یافت نشد"
            description="با معیارهای جستجو یا فیلتر انتخاب‌شده پروژه‌ای پیدا نشد."
            action={
              <Button variant="outline" onClick={clearFilters}>
                <X className="h-4 w-4" />
                پاک کردن فیلترها
              </Button>
            }
          />
        )}

        {data && items.length > 0 && (
          <>
            <HorizontalScroll
              className={
                isFetching ? "opacity-70 transition-opacity" : undefined
              }
            >
              <Table className="min-w-[48rem]">
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="sticky top-0 z-[1] whitespace-nowrap bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                      کد
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                      عنوان
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                      مشتری
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] min-w-[10rem] bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                      ادیتور
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] min-w-[10rem] bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                      نریتور
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] whitespace-nowrap bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                      وضعیت
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] min-w-[10rem] bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                      پیشرفت پروژه
                    </TableHead>
                    {canDeleteProject && (
                      <TableHead className="sticky top-0 z-[1] w-14 bg-muted/95 text-center backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                        عملیات
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((project) => (
                  <TableRow
                    key={project.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`مشاهده جزئیات پروژه ${project.code}`}
                    className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
                    onClick={() => openProject(project.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openProject(project.id);
                      }
                    }}
                  >
                    <TableCell>
                      <span
                        className="whitespace-nowrap font-medium text-foreground"
                        dir="ltr"
                      >
                        {project.code}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="block min-w-[8rem] max-w-[16rem] font-medium leading-snug">
                        {project.title}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-[8rem]">
                        <span className="font-medium">
                          {project.crmCustomer.personName}
                        </span>
                        {project.crmCustomer.companyName && (
                          <span className="block text-xs text-muted-foreground">
                            {project.crmCustomer.companyName}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const editor = getAssignedPerson(project, "EDITOR");
                        return editor ? (
                          <div
                            className="flex min-w-[10rem] items-center gap-3 overflow-hidden text-sm"
                            title={editor.name}
                          >
                            <UserAvatar
                              name={editor.name}
                              profileImage={editor.profileImage}
                              className="h-8 w-8"
                            />
                            <span className="truncate text-sm font-medium">
                              {editor.name}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex min-w-[10rem] items-center text-sm text-muted-foreground">
                            تعیین نشده
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const narrator = getAssignedPerson(project, "NARRATOR");
                        return narrator ? (
                          <div
                            className="flex min-w-[10rem] items-center gap-3 overflow-hidden text-sm"
                            title={narrator.name}
                          >
                            <UserAvatar
                              name={narrator.name}
                              profileImage={narrator.profileImage}
                              className="h-8 w-8"
                            />
                            <span className="truncate text-sm font-medium">
                              {narrator.name}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex min-w-[10rem] items-center text-sm text-muted-foreground">
                            تعیین نشده
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          project.status === "COMPLETED"
                            ? "success"
                            : "secondary"
                        }
                        className="whitespace-nowrap"
                      >
                        {getProjectStatusLabel(project.status)}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="min-w-[10rem]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ProjectProgressBar
                        progress={project.progress}
                        status={project.status}
                        variant="inline"
                        showTitle={false}
                      />
                    </TableCell>
                    {canDeleteProject && (
                      <TableCell
                        className="text-center"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                          title="حذف پروژه"
                          aria-label="حذف پروژه"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDelete(project);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                </TableBody>
              </Table>
            </HorizontalScroll>

            <TablePagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              isFetching={isFetching}
            />
          </>
        )}
      </div>
    </div>
  );
}
