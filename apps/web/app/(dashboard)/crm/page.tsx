"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useQuery,
  keepPreviousData,
} from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { formatDate, formatPhoneDisplay } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingTable } from "@/components/shared/loading-table";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  X,
} from "lucide-react";
import { CustomerFormDialog } from "./_components/customer-form-dialog";
import { DeleteCustomerDialog } from "./_components/delete-customer-dialog";
import { CustomerActions } from "./_components/customer-actions";
import { formatLeadSource } from "./_components/constants";
import type { CrmCustomer, CrmFormOptions, CrmListResponse } from "./_components/types";

const PAGE_SIZE = 20;
const ALL = "ALL";

export default function CrmPage() {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState(ALL);
  const [salesOwnerId, setSalesOwnerId] = useState(ALL);
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CrmCustomer | null>(
    null
  );
  const [deletingCustomer, setDeletingCustomer] = useState<CrmCustomer | null>(
    null
  );
  const [deleteOpen, setDeleteOpen] = useState(false);

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
    if (source !== ALL) params.set("source", source);
    if (salesOwnerId !== ALL) params.set("salesOwnerId", salesOwnerId);
    return params.toString();
  }, [page, search, source, salesOwnerId]);

  const { data: formOptions } = useQuery({
    queryKey: ["crm-form-options"],
    queryFn: () => apiGet<CrmFormOptions>("/crm/form-options"),
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["crm-customers", { search, source, salesOwnerId, page }],
    queryFn: () => apiGet<CrmListResponse>(`/crm/customers?${listParams}`),
    placeholderData: keepPreviousData,
  });

  const hasFilters =
    search !== "" ||
    source !== ALL ||
    salesOwnerId !== ALL;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const openCreate = () => {
    setEditingCustomer(null);
    setFormOpen(true);
  };

  const openEdit = (customer: CrmCustomer) => {
    setEditingCustomer(customer);
    setFormOpen(true);
  };

  const openDelete = (customer: CrmCustomer) => {
    setDeletingCustomer(customer);
    setDeleteOpen(true);
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setSource(ALL);
    setSalesOwnerId(ALL);
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="مدیریت مشتری"
        subtitle="لیست مشتریان و سرنخ‌های فروش"
        actions={
          <Button variant="brand" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            مشتری جدید
          </Button>
        }
      />

      <CustomerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={editingCustomer}
      />
      <DeleteCustomerDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        customer={deletingCustomer}
      />

      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="جستجو بر اساس نام، شرکت یا واتساپ..."
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
            value={source}
            onValueChange={(value) => {
              setSource(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="sm:w-44">
              <SelectValue placeholder="منبع ورود" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>همه منابع</SelectItem>
              {(formOptions?.leadSources ?? []).map((item) => (
                <SelectItem key={item.code} value={item.code}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={salesOwnerId}
            onValueChange={(value) => {
              setSalesOwnerId(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="sm:w-44">
              <SelectValue placeholder="مسئول فروش" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>همه مسئولین</SelectItem>
              {(formOptions?.salesReps ?? []).map((rep) => (
                <SelectItem key={rep.id} value={rep.id}>
                  {rep.fullName}
                </SelectItem>
              ))}
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
              {data.total.toLocaleString("fa-AF", { numberingSystem: "latn" })} مشتری
            </p>
          )}
        </div>

        {isLoading && <LoadingTable columns={6} />}

        {error && (
          <EmptyState
            title="بارگذاری مشتریان ناموفق بود"
            description="لطفاً اتصال خود را بررسی کرده و دوباره تلاش کنید."
          />
        )}

        {data && data.items.length === 0 && (
          <EmptyState
            title={hasFilters ? "نتیجه‌ای یافت نشد" : "مشتری ثبت نشده است"}
            description={
              hasFilters
                ? "با معیارهای جستجو یا فیلتر انتخاب‌شده مشتری‌ای پیدا نشد."
                : "اولین مشتری یا سرنخ خود را ثبت کنید تا اینجا نمایش داده شود."
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
                  مشتری جدید
                </Button>
              )
            }
          />
        )}

        {data && data.items.length > 0 && (
          <>
            {/* Desktop / tablet table */}
            <div
              className={`hidden overflow-x-auto rounded-lg border md:block ${
                isFetching ? "opacity-70 transition-opacity" : ""
              }`}
            >
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>مشتری</TableHead>
                    <TableHead>تماس</TableHead>
                    <TableHead className="hidden lg:table-cell">منبع ورود</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      مسئول فروش
                    </TableHead>
                    <TableHead className="hidden xl:table-cell">
                      تاریخ ایجاد
                    </TableHead>
                    <TableHead className="w-14 text-center">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((customer) => (
                    <TableRow
                      key={customer.id}
                      role="link"
                      tabIndex={0}
                      className="cursor-pointer"
                      onClick={() => router.push(`/crm/${customer.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/crm/${customer.id}`);
                        }
                      }}
                    >
                      <TableCell>
                        <div className="font-medium">
                          {customer.personName}
                          {customer.companyName && (
                            <span className="block text-xs font-normal text-muted-foreground">
                              {customer.companyName}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <span
                            dir="ltr"
                            className="block text-right text-sm font-medium tabular-nums tracking-wide text-foreground"
                            title={customer.whatsappRaw}
                          >
                            {formatPhoneDisplay(customer.whatsappRaw)}
                          </span>
                          {customer.email && (
                            <span
                              dir="ltr"
                              className="block max-w-[200px] truncate text-right text-xs text-muted-foreground"
                              title={customer.email}
                            >
                              {customer.email}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-sm lg:table-cell">
                        {formatLeadSource(customer.source)}
                      </TableCell>
                      <TableCell className="hidden text-sm lg:table-cell">
                        {customer.salesOwner?.fullName || "—"}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">
                        {formatDate(customer.createdAt)}
                      </TableCell>
                      <TableCell
                        className="text-center"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <CustomerActions
                          customer={customer}
                          onEdit={openEdit}
                          onDelete={openDelete}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div
              className={`space-y-3 md:hidden ${
                isFetching ? "opacity-70 transition-opacity" : ""
              }`}
            >
              {data.items.map((customer) => (
                <div
                  key={customer.id}
                  role="link"
                  tabIndex={0}
                  className="cursor-pointer rounded-lg border bg-background p-4 shadow-sm transition-colors hover:border-brand/40 hover:bg-muted/20"
                  onClick={() => router.push(`/crm/${customer.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/crm/${customer.id}`);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 font-medium">
                      {customer.personName}
                      {customer.companyName && (
                        <span className="block truncate text-xs font-normal text-muted-foreground">
                          {customer.companyName}
                        </span>
                      )}
                    </div>
                    <div
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <CustomerActions
                        customer={customer}
                        onEdit={openEdit}
                        onDelete={openDelete}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      dir="ltr"
                      className="text-sm font-medium tabular-nums tracking-wide text-foreground"
                      title={customer.whatsappRaw}
                    >
                      {formatPhoneDisplay(customer.whatsappRaw)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <p>
                      منبع:{" "}
                      <span className="text-foreground">
                        {formatLeadSource(customer.source)}
                      </span>
                    </p>
                    <p>
                      مسئول فروش:{" "}
                      <span className="text-foreground">
                        {customer.salesOwner?.fullName || "—"}
                      </span>
                    </p>
                    <p className="col-span-2">
                      تاریخ ایجاد:{" "}
                      <span className="text-foreground">
                        {formatDate(customer.createdAt)}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
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
