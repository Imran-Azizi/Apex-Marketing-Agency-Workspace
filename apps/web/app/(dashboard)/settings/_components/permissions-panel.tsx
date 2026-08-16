"use client";

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search, Shield, SlidersHorizontal, X } from "lucide-react";
import { apiGet } from "@/lib/api";
import { cn } from "@/lib/utils";
import { filePreviewUrl } from "@/lib/upload";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
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
import { HorizontalScroll } from "@/components/shared/horizontal-scroll";
import { ManagePermissionsDialog } from "./manage-permissions-dialog";

type PermissionEmployee = {
  id: string;
  fullName: string;
  email: string;
  profileImage: string | null;
  isActive: boolean;
  role: { code: string; name: string };
  totalPermissions: number;
  enabledCount: number;
  disabledCount: number;
  isCustomized: boolean;
  locked: boolean;
  canManage: boolean;
};

type ListResponse = {
  items: PermissionEmployee[];
  total: number;
  page: number;
  pageSize: number;
  catalogTotal: number;
};

const ROLE_LABELS: Record<string, string> = {
  MANAGER: "مدیر",
  ADMIN: "ادمین",
  SALES: "فروش",
  EDITOR: "ادیتور",
  NARRATOR: "نریتور",
  FINANCE: "مالی",
};

const ALL = "ALL";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

export function PermissionsPanel() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState(ALL);
  const [page, setPage] = useState(1);
  const [managingId, setManagingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const params = useMemo(() => {
    const q = new URLSearchParams();
    q.set("page", String(page));
    q.set("pageSize", "20");
    if (search) q.set("q", search);
    if (role !== ALL) q.set("role", role);
    return q.toString();
  }, [page, search, role]);

  const listQ = useQuery({
    queryKey: ["permission-employees", { search, role, page }],
    queryFn: () => apiGet<ListResponse>(`/permissions/employees?${params}`),
    placeholderData: keepPreviousData,
  });

  const items = listQ.data?.items || [];
  const catalogTotal = listQ.data?.catalogTotal || 0;

  return (
    <section
      dir="rtl"
      className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
      aria-labelledby="rbac-title"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 bg-muted/20 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Shield className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-1 text-start">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="rbac-title"
                className="text-base font-semibold tracking-tight text-foreground"
              >
                نقش‌ها و دسترسی‌ها
              </h2>
              <Badge variant="secondary" className="font-normal">
                مدیریت مجوزها
              </Badge>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              اعطا یا سلب دسترسی ماژول‌ها و عملیات برای هر کارمند، بدون تغییر حساب
              یا پروژه‌های موجود
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              dir="rtl"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="جستجو بر اساس نام یا ایمیل..."
              className="ps-9 text-start"
            />
            {searchInput ? (
              <button
                type="button"
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchInput("")}
                aria-label="پاک کردن جستجو"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <Select
            dir="rtl"
            value={role}
            onValueChange={(value) => {
              setRole(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-10 w-full sm:w-44" dir="rtl">
              <span className="flex min-w-0 items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
                <SelectValue placeholder="نقش" />
              </span>
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value={ALL}>همه نقش‌ها</SelectItem>
              {Object.entries(ROLE_LABELS).map(([code, label]) => (
                <SelectItem key={code} value={code}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {listQ.isLoading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : null}

        {listQ.error ? (
          <EmptyState title="بارگذاری کارمندان ناموفق بود" />
        ) : null}

        {!listQ.isLoading && !listQ.error && items.length === 0 ? (
          <EmptyState title="کارمندی یافت نشد" />
        ) : null}

        {items.length > 0 ? (
          <HorizontalScroll dir="rtl">
            <Table dir="rtl" className="min-w-[44rem]">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-start">کارمند</TableHead>
                  <TableHead className="text-start">نقش</TableHead>
                  <TableHead className="text-start">خلاصه دسترسی</TableHead>
                  <TableHead className="text-start">وضعیت</TableHead>
                  <TableHead className="w-36 text-start">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((emp) => {
                  const imageUrl = emp.profileImage
                    ? filePreviewUrl(emp.profileImage)
                    : null;
                  const pct = emp.totalPermissions
                    ? Math.round((emp.enabledCount / emp.totalPermissions) * 100)
                    : 0;
                  return (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 shrink-0">
                            {imageUrl ? (
                              <AvatarImage
                                src={imageUrl}
                                alt={emp.fullName}
                                className="object-cover"
                              />
                            ) : null}
                            <AvatarFallback className="bg-brand-muted text-xs text-brand">
                              {initials(emp.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 text-start">
                            <p className="truncate text-sm font-medium">
                              {emp.fullName}
                            </p>
                            <p
                              className="truncate text-xs text-muted-foreground"
                              dir="ltr"
                            >
                              {emp.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-start">
                        <Badge variant="secondary">
                          {ROLE_LABELS[emp.role.code] || emp.role.code}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-[9rem] space-y-1 text-start">
                          <p className="text-xs text-muted-foreground">
                            {emp.enabledCount} از {emp.totalPermissions || catalogTotal} فعال
                          </p>
                          <div
                            dir="rtl"
                            className="h-1.5 overflow-hidden rounded-full bg-muted"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={pct}
                            aria-label={`${emp.enabledCount} از ${emp.totalPermissions || catalogTotal} دسترسی فعال`}
                          >
                            <div
                              className="h-full rounded-full bg-brand transition-[width] duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-start">
                        {emp.locked ? (
                          <Badge variant="outline">دسترسی کامل</Badge>
                        ) : emp.isCustomized ? (
                          <Badge variant="warning">سفارشی</Badge>
                        ) : (
                          <Badge variant="success">پیش‌فرض نقش</Badge>
                        )}
                        {!emp.isActive ? (
                          <Badge variant="destructive" className="ms-1">
                            غیرفعال
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-start">
                        <Button
                          size="sm"
                          variant={emp.canManage ? "brand" : "outline"}
                          disabled={!emp.canManage}
                          onClick={() => setManagingId(emp.id)}
                          className={cn("h-8")}
                        >
                          مدیریت دسترسی
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </HorizontalScroll>
        ) : null}
      </div>

      <ManagePermissionsDialog
        employeeId={managingId}
        open={!!managingId}
        onOpenChange={(next) => {
          if (!next) setManagingId(null);
        }}
      />
    </section>
  );
}
