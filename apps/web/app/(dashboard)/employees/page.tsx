"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { formatDate, formatPhoneDisplay } from "@/lib/utils";
import { filePreviewUrl } from "@/lib/upload";
import { PageHeader } from "@/components/shared/page-header";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
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

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fa-AF", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [page, setPage] = useState(1);

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

  return (
    <div>
      <PageHeader
        title="مدیریت کارمندان"
        subtitle="ایجاد و مدیریت کاربران فروش، ادیتور، نریتور و مالی"
        actions={
          <Button variant="brand" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            ایجاد کارمند جدید
          </Button>
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

      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="relative flex-1 sm:max-w-sm">
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
          <Select
            value={role}
            onValueChange={(value) => {
              setRole(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="sm:w-44">
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
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="sm:w-40">
              <SelectValue placeholder="وضعیت" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>همه وضعیت‌ها</SelectItem>
              <SelectItem value="active">فعال</SelectItem>
              <SelectItem value="inactive">غیرفعال</SelectItem>
            </SelectContent>
          </Select>
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
            <p className="text-sm text-muted-foreground sm:ms-auto">
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
              ) : (
                <Button variant="brand" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  ایجاد کارمند جدید
                </Button>
              )
            }
          />
        )}

        {data && data.items.length > 0 && (
          <>
            <div
              className={`hidden overflow-x-auto rounded-lg border md:block ${
                isFetching ? "opacity-70 transition-opacity" : ""
              }`}
            >
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>نام کامل</TableHead>
                    <TableHead>ایمیل / نام کاربری</TableHead>
                    <TableHead>نقش</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead className="hidden lg:table-cell">تاریخ ایجاد</TableHead>
                    <TableHead className="hidden xl:table-cell">آخرین ورود</TableHead>
                    <TableHead className="w-14 text-center">عملیات</TableHead>
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
                        onClick={() => router.push(`/employees/${employee.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push(`/employees/${employee.id}`);
                          }
                        }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
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
                            <div>
                              <div className="font-medium">{employee.fullName}</div>
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
                          <span dir="ltr" className="text-sm">
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
                            variant={employee.isActive ? "success" : "secondary"}
                          >
                            {employee.isActive ? "فعال" : "غیرفعال"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                          {formatDate(employee.createdAt)}
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">
                          {formatDateTime(employee.lastLoginAt)}
                        </TableCell>
                        <TableCell
                          className="text-center"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <EmployeeActions
                            employee={employee}
                            onEdit={openEdit}
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
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div
              className={`space-y-3 md:hidden ${
                isFetching ? "opacity-70 transition-opacity" : ""
              }`}
            >
              {data.items.map((employee) => {
                const roleCode = employee.role.code as StaffRole;
                return (
                  <div
                    key={employee.id}
                    role="link"
                    tabIndex={0}
                    className="cursor-pointer rounded-lg border bg-background p-4 shadow-sm transition-colors hover:border-brand/40 hover:bg-muted/20"
                    onClick={() => router.push(`/employees/${employee.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/employees/${employee.id}`);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="h-10 w-10">
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
                          <div className="font-medium">{employee.fullName}</div>
                          <span
                            dir="ltr"
                            className="block truncate text-xs text-muted-foreground"
                          >
                            {employee.email}
                          </span>
                        </div>
                      </div>
                      <div
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <EmployeeActions
                          employee={employee}
                          onEdit={openEdit}
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
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge
                        variant={ROLE_BADGE_VARIANTS[roleCode] || "secondary"}
                      >
                        {ROLE_LABELS_FA[roleCode] || employee.role.code}
                      </Badge>
                      <Badge
                        variant={employee.isActive ? "success" : "secondary"}
                      >
                        {employee.isActive ? "فعال" : "غیرفعال"}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <p>
                        ایجاد:{" "}
                        <span className="text-foreground">
                          {formatDate(employee.createdAt)}
                        </span>
                      </p>
                      <p>
                        آخرین ورود:{" "}
                        <span className="text-foreground">
                          {formatDateTime(employee.lastLoginAt)}
                        </span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                <p className="text-sm text-muted-foreground">
                  صفحه {page.toLocaleString("fa-AF", { numberingSystem: "latn" })} از{" "}
                  {totalPages.toLocaleString("fa-AF", { numberingSystem: "latn" })}
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
