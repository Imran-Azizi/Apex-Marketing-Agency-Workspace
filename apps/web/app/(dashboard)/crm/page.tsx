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
import { HorizontalScroll } from "@/components/shared/horizontal-scroll";
import { LoadingTable } from "@/components/shared/loading-table";
import { EmptyState } from "@/components/shared/empty-state";
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
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useHasPermission } from "@/lib/permissions";
import { CustomerFormDialog } from "./_components/customer-form-dialog";
import { DeleteCustomerDialog } from "./_components/delete-customer-dialog";
import { CustomerActions } from "./_components/customer-actions";
import { formatLeadSource } from "./_components/constants";
import type { CrmCustomer, CrmFormOptions, CrmListResponse } from "./_components/types";

const PAGE_SIZE = 20;
const ALL = "ALL";

export default function CrmPage() {
  const router = useRouter();
  const canCreate = useHasPermission("crm.create");
  const canEdit = useHasPermission("crm.edit");
  const canDelete = useHasPermission("crm.delete");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState(ALL);
  const [salesOwnerId, setSalesOwnerId] = useState(ALL);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  const activeDropdownFilters =
    (source !== ALL ? 1 : 0) + (salesOwnerId !== ALL ? 1 : 0);
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

  const clearDropdownFilters = () => {
    setSource(ALL);
    setSalesOwnerId(ALL);
    setPage(1);
  };

  function renderSourceSelect(triggerClassName?: string) {
    return (
      <Select
        value={source}
        onValueChange={(value) => {
          setSource(value);
          setPage(1);
        }}
      >
        <SelectTrigger className={triggerClassName ?? "w-full sm:w-44"}>
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
    );
  }

  function renderSalesOwnerSelect(triggerClassName?: string) {
    return (
      <Select
        value={salesOwnerId}
        onValueChange={(value) => {
          setSalesOwnerId(value);
          setPage(1);
        }}
      >
        <SelectTrigger className={triggerClassName ?? "w-full sm:w-44"}>
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
    );
  }

  function renderSearchField(className?: string) {
    return (
      <div className={`relative min-w-0 flex-1 ${className ?? "sm:max-w-sm"}`}>
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
    );
  }

  return (
    <div className="min-w-0">
      <PageHeader
        inline
        title="مدیریت مشتری"
        subtitle="لیست مشتریان و سرنخ‌های فروش"
        actions={
          canCreate ? (
          <Button
            variant="brand"
            onClick={openCreate}
            className="h-9 shrink-0 gap-1.5 px-3 text-sm sm:h-10 sm:px-4"
          >
            <Plus className="h-4 w-4" />
            <span className="whitespace-nowrap">مشتری جدید</span>
          </Button>
          ) : undefined
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

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
        >
          <SheetHeader className="text-start">
            <SheetTitle>فیلترها</SheetTitle>
            <SheetDescription>
              منبع ورود و مسئول فروش را انتخاب کنید. فیلترها بلافاصله اعمال می‌شوند.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">منبع ورود</p>
              {renderSourceSelect("w-full")}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">مسئول فروش</p>
              {renderSalesOwnerSelect("w-full")}
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
            {data.total.toLocaleString("fa-AF", { numberingSystem: "latn" })} مشتری
          </p>
        )}

        {/* Desktop / tablet: inline filters */}
        <div className="hidden items-center gap-2 md:flex">
          {renderSearchField()}
          {renderSourceSelect()}
          {renderSalesOwnerSelect()}
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
            <p className="text-sm text-muted-foreground ms-auto">
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
              ) : canCreate ? (
                <Button variant="brand" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  مشتری جدید
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
              <Table className="min-w-[40rem]">
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="sticky top-0 z-[1] bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                        مشتری
                      </TableHead>
                      <TableHead className="sticky top-0 z-[1] bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                        تماس
                      </TableHead>
                      <TableHead className="sticky top-0 z-[1] whitespace-nowrap bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                        منبع ورود
                      </TableHead>
                      <TableHead className="sticky top-0 z-[1] whitespace-nowrap bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                        مسئول فروش
                      </TableHead>
                      <TableHead className="sticky top-0 z-[1] whitespace-nowrap bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                        تاریخ ایجاد
                      </TableHead>
                      <TableHead className="sticky top-0 z-[1] w-14 bg-muted/95 text-center backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                        عملیات
                      </TableHead>
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
                          <div className="min-w-[8rem] font-medium">
                            {customer.personName}
                            {customer.companyName && (
                              <span className="block text-xs font-normal text-muted-foreground">
                                {customer.companyName}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[9rem] space-y-0.5">
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
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatLeadSource(customer.source)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {customer.salesOwner?.fullName || "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
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
                            canEdit={canEdit}
                            canDelete={canDelete}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
            </HorizontalScroll>

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
