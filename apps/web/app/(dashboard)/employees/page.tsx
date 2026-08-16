"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { formatDate, formatDateTime, formatPhoneDisplay } from "@/lib/utils";
import { filePreviewUrl } from "@/lib/upload";
import { PageHeader } from "@/components/shared/page-header";
import { HorizontalScroll } from "@/components/shared/horizontal-scroll";
import { LoadingTable } from "@/components/shared/loading-table";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useHasPermission } from "@/lib/permissions";
import { EmployeeFormDialog } from "./_components/employee-form-dialog";
import { DeleteEmployeeDialog } from "./_components/delete-employee-dialog";
import { ResetPasswordDialog } from "./_components/reset-password-dialog";
import { ToggleStatusDialog } from "./_components/toggle-status-dialog";
import { EmployeeActions } from "./_components/employee-actions";
import {
  ROLE_BADGE_VARIANTS,
  ROLE_LABELS_FA,
  STAFF_ROLES,
  type Employee,
  type EmployeeListResponse,
  type StaffRole,
} from "./_components/types";

const PAGE_SIZE = 20;
const ALL = "ALL";

function formatOptionalDateTime(value: string | null) {
  if (!value) return "—";
  return formatDateTime(value);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
}

export default function EmployeesPage() {
  const router = useRouter();
  const canCreate = useHasPermission("employees.create");
  const canEdit = useHasPermission("employees.edit");
  const canDisable = useHasPermission("employees.disable");
  const canDelete = useHasPermission("employees.delete");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState<Employee | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Employee | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Employee | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const listParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    if (search) params.set("q", search);
    if (role !== ALL) params.set("role", role);
    if (status !== ALL) params.set("status", status);
    return params.toString();
  }, [page, search, role, status]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["employees", { search, role, status, page }],
    queryFn: () => apiGet<EmployeeListResponse>(`/employees?${listParams}`),
    placeholderData: keepPreviousData,
  });

  const activeDropdownFilters =
    (role !== ALL ? 1 : 0) + (status !== ALL ? 1 : 0);
  const hasFilters = search !== "" || role !== ALL || status !== ALL;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (employee: Employee) => {
    setEditing(employee);
    setFormOpen(true);
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setRole(ALL);
    setStatus(ALL);
    setPage(1);
  };

  const clearDropdownFilters = () => {
    setRole(ALL);
    setStatus(ALL);
    setPage(1);
  };

  function renderRoleSelect(triggerClassName?: string) {
    return (
      <Select
        value={role}
        onValueChange={(value) => {
          setRole(value);
          setPage(1);
        }}
      >
        <SelectTrigger className={triggerClassName ?? "w-full sm:w-44"}>
          <SelectValue placeholder="فیلتر نقش" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>همه نقش‌ها</SelectItem>
          {STAFF_ROLES.map((r) => (
            <SelectItem key={r} value={r}>
              {ROLE_LABELS_FA[r]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  function renderStatusSelect(triggerClassName?: string) {
    return (
      <Select
        value={status}
        onValueChange={(value) => {
          setStatus(value);
          setPage(1);
        }}
      >
        <SelectTrigger className={triggerClassName ?? "w-full sm:w-40"}>
          <SelectValue placeholder="وضعیت" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>همه وضعیت‌ها</SelectItem>
          <SelectItem value="active">فعال</SelectItem>
          <SelectItem value="inactive">غیرفعال</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  function renderSearchField(className?: string) {
    return (
      <div className={`relative min-w-0 flex-1 ${className ?? "sm:max-w-sm"}`}>
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="جستجو بر اساس نام، ایمیل یا تلفن..."
          className="ps-9"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => setSearchInput("")}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            title="پاک کردن جستجو"
            aria-label="پاک کردن جستجو"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  function renderEmployeeActions(employee: Employee) {
    return (
      <EmployeeActions
        employee={employee}
        onEdit={openEdit}
        canEdit={canEdit}
        canDisable={canDisable}
        canDelete={canDelete}
        onToggleStatus={(emp) => {
          setStatusTarget(emp);
          setStatusOpen(true);
        }}
        onResetPassword={(emp) => {
          setResetTarget(emp);
          setResetOpen(true);
        }}
        onDelete={(emp) => {
          setDeleting(emp);
          setDeleteOpen(true);
        }}
      />
    );
  }

  return (
    <div className="min-w-0">
      <PageHeader
        inline
        title="مدیریت کارمندان"
        subtitle="ایجاد و مدیریت کاربران فروش، ادیتور، نریتور و مالی"
        actions={
          canCreate ? (
          <Button
            variant="brand"
            onClick={openCreate}
            className="h-9 shrink-0 gap-1.5 px-3 text-sm sm:h-10 sm:px-4"
          >
            <Plus className="h-4 w-4" />
            <span className="whitespace-nowrap">ایجاد کارمند جدید</span>
          </Button>
          ) : undefined
        }
      />

      <EmployeeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        employee={editing}
      />
      <DeleteEmployeeDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        employee={deleting}
      />
      <ResetPasswordDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        employee={resetTarget}
      />
      <ToggleStatusDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        employee={statusTarget}
      />

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
        >
          <SheetHeader className="text-start">
            <SheetTitle>فیلترها</SheetTitle>
            <SheetDescription>
              نقش و وضعیت کارمند را انتخاب کنید. فیلترها بلافاصله اعمال می‌شوند.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">نقش</p>
              {renderRoleSelect("w-full")}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">وضعیت</p>
              {renderStatusSelect("w-full")}
            </div>
          </div>

          <SheetFooter className="mt-6 flex-row gap-2 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={clearDropdownFilters}
              disabled={activeDropdownFilters === 0}
            >
              <X className="h-4 w-4" />
              حذف فیلترها
            </Button>
            <Button
              type="button"
              variant="brand"
              className="flex-1"
              onClick={() => setFiltersOpen(false)}
            >
              مشاهده نتایج
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <div className="space-y-4">
        {/* Mobile: search + filters button */}
        <div className="flex items-center gap-2 md:hidden">
          {renderSearchField("")}
          <Button
            type="button"
            variant={activeDropdownFilters > 0 ? "secondary" : "outline"}
            className="relative h-10 shrink-0 gap-1.5 px-3"
            onClick={() => setFiltersOpen(true)}
            aria-label="باز کردن فیلترها"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>فیلترها</span>
            {activeDropdownFilters > 0 && (
              <Badge
                variant="brand"
                className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px] leading-none"
              >
                {activeDropdownFilters.toLocaleString("fa-AF", {
                  numberingSystem: "latn",
                })}
              </Badge>
            )}
          </Button>
        </div>

        {data && (
          <p className="text-sm text-muted-foreground md:hidden">
            {data.total.toLocaleString("fa-AF", { numberingSystem: "latn" })} کارمند
          </p>
        )}

        {/* Desktop / tablet: inline filters */}
        <div className="hidden items-center gap-2 md:flex">
          {renderSearchField()}
          {renderRoleSelect()}
          {renderStatusSelect()}
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-1.5 text-muted-foreground"
            >
              <X className="h-4 w-4" />
              حذف فیلترها
            </Button>
          )}
          {data && (
            <p className="ms-auto text-sm text-muted-foreground">
              {data.total.toLocaleString("fa-AF", { numberingSystem: "latn" })} کارمند
            </p>
          )}
        </div>

        {isLoading && <LoadingTable columns={7} />}

        {error && (
          <EmptyState
            title="بارگذاری کارمندان ناموفق بود"
            description="لطفاً اتصال خود را بررسی کرده و دوباره تلاش کنید."
          />
        )}

        {data && data.items.length === 0 && (
          <EmptyState
            title={hasFilters ? "نتیجه‌ای یافت نشد" : "کارمندی ثبت نشده است"}
            description={
              hasFilters
                ? "با معیارهای جستجو یا فیلتر انتخاب‌شده کارمندی پیدا نشد."
                : "اولین کارمند را با نقش فروش، ادیتور، نریتور یا مالی ایجاد کنید."
            }
            action={
              hasFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  <X className="h-4 w-4" />
                  حذف فیلترها
                </Button>
              ) : canCreate ? (
                <Button variant="brand" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  ایجاد کارمند جدید
                </Button>
              ) : undefined
            }
          />
        )}

        {data && data.items.length > 0 && (
          <>
            <HorizontalScroll
              className={
                isFetching ? "opacity-70 transition-opacity" : undefined
              }
            >
              <Table className="min-w-[48rem]">
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="sticky top-0 z-[1] bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                        نام کامل
                      </TableHead>
                      <TableHead className="sticky top-0 z-[1] whitespace-nowrap bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                        ایمیل / نام کاربری
                      </TableHead>
                      <TableHead className="sticky top-0 z-[1] bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                        نقش
                      </TableHead>
                      <TableHead className="sticky top-0 z-[1] bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                        وضعیت
                      </TableHead>
                      <TableHead className="sticky top-0 z-[1] whitespace-nowrap bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                        تاریخ ایجاد
                      </TableHead>
                      <TableHead className="sticky top-0 z-[1] whitespace-nowrap bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                        آخرین ورود
                      </TableHead>
                      <TableHead className="sticky top-0 z-[1] w-14 bg-muted/95 text-center backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                        عملیات
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((employee) => {
                      const roleCode = employee.role.code as StaffRole;
                      return (
                        <TableRow
                          key={employee.id}
                          role="link"
                          tabIndex={0}
                          className="cursor-pointer"
                          onClick={() =>
                            router.push(`/employees/${employee.id}`)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              router.push(`/employees/${employee.id}`);
                            }
                          }}
                        >
                          <TableCell>
                            <div className="flex min-w-[10rem] items-center gap-3">
                              <Avatar className="h-9 w-9 shrink-0">
                                {employee.profileImage ? (
                                  <AvatarImage
                                    src={
                                      filePreviewUrl(employee.profileImage) ||
                                      undefined
                                    }
                                    alt=""
                                  />
                                ) : null}
                                <AvatarFallback>
                                  {initials(employee.fullName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="font-medium">
                                  {employee.fullName}
                                </div>
                                {employee.phone && (
                                  <span
                                    dir="ltr"
                                    className="block text-xs text-muted-foreground"
                                  >
                                    {formatPhoneDisplay(employee.phone)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              dir="ltr"
                              className="block max-w-[14rem] truncate text-sm"
                              title={employee.email}
                            >
                              {employee.email}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                ROLE_BADGE_VARIANTS[roleCode] || "secondary"
                              }
                            >
                              {ROLE_LABELS_FA[roleCode] || employee.role.code}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                employee.isActive ? "success" : "secondary"
                              }
                            >
                              {employee.isActive ? "فعال" : "غیرفعال"}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {formatDate(employee.createdAt)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {formatOptionalDateTime(employee.lastLoginAt)}
                          </TableCell>
                          <TableCell
                            className="text-center"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            {renderEmployeeActions(employee)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
            </HorizontalScroll>

            {totalPages > 1 && (
              <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                <p className="text-sm text-muted-foreground">
                  صفحه{" "}
                  {page.toLocaleString("fa-AF", { numberingSystem: "latn" })} از{" "}
                  {totalPages.toLocaleString("fa-AF", {
                    numberingSystem: "latn",
                  })}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || isFetching}
                  >
                    <ChevronRight className="h-4 w-4" />
                    قبلی
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={page >= totalPages || isFetching}
                  >
                    بعدی
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
