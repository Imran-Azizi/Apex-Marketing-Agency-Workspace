"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { formatDate, formatPhoneDisplay } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { HorizontalScroll } from "@/components/shared/horizontal-scroll";
import { LoadingTable } from "@/components/shared/loading-table";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Search, Send, SlidersHorizontal, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useHasPermission, useMeQuery } from "@/lib/permissions";
import { TablePagination } from "@/components/shared/table-pagination";
import { CustomerFormDialog } from "./_components/customer-form-dialog";
import { DeleteCustomerDialog } from "@/app/(dashboard)/crm/_components/delete-customer-dialog";
import { BulkDeleteCustomersDialog } from "@/app/(dashboard)/crm/_components/bulk-delete-customers-dialog";
import { CrmSelectionBar } from "@/app/(dashboard)/crm/_components/crm-selection-bar";
import { useCustomerSelection } from "@/app/(dashboard)/crm/_components/use-customer-selection";
import { CustomerActions } from "./_components/customer-actions";
import { CustomerManagementIndicator } from "./_components/customer-management-indicator";
import { CrmDashboardStats } from "./_components/crm-dashboard-stats";
import { TransferDialog } from "./_components/transfer-dialog";
import { CustomerStatusSelect } from "./_components/customer-status-select";
import { InvoiceCreateDialog } from "./_components/invoice-create-dialog";
import { CrmInvoicesDialog } from "./_components/crm-invoices-dialog";
import {
  formatLeadSource,
  STAGE_LABELS,
  CATEGORY_LABELS,
  categoryBadgeVariant,
} from "./_components/constants";
import { crmSalesText } from "./_components/copy";
import type {
  CrmCustomer,
  CrmDashboardStats as DashboardStats,
  CrmFormOptions,
  CrmListResponse,
  CrmTransferResult,
} from "./_components/types";

const PAGE_SIZE = 15;
const ALL = "ALL";

export default function CrmPage() {
  const queryClient = useQueryClient();
  const { data: me } = useMeQuery();
  const isSalesUser = me?.role === "SALES";
  const canCreate = useHasPermission("crm.create");
  const canEdit = useHasPermission("crm.edit");
  const canDelete = useHasPermission("crm.delete");
  const canInvoice = useHasPermission(["finance.create", "crm.opportunity"]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState(ALL);
  const [salesOwnerId, setSalesOwnerId] = useState(ALL);
  const [stage, setStage] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CrmCustomer | null>(
    null,
  );
  const [deletingCustomer, setDeletingCustomer] = useState<CrmCustomer | null>(
    null,
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [invoiceCustomer, setInvoiceCustomer] = useState<CrmCustomer | null>(
    null,
  );
  const [invoicesCustomer, setInvoicesCustomer] = useState<CrmCustomer | null>(
    null,
  );
  const [openedInvoiceId, setOpenedInvoiceId] = useState<string | null>(null);

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
    if (stage !== ALL) params.set("stage", stage);
    if (category !== ALL) params.set("category", category);
    params.set("scope", "pipeline");
    return params.toString();
  }, [page, search, source, salesOwnerId, stage, category]);

  const { data: formOptions } = useQuery({
    queryKey: ["crm-form-options"],
    queryFn: () => apiGet<CrmFormOptions>("/crm/form-options"),
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: [
      "crm-customers",
      "pipeline",
      { search, source, salesOwnerId, stage, category, page, pageSize: PAGE_SIZE },
    ],
    queryFn: () => apiGet<CrmListResponse>(`/crm/customers?${listParams}`),
    placeholderData: keepPreviousData,
  });

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ["crm-dashboard", "pipeline"],
    queryFn: () => apiGet<DashboardStats>("/crm/dashboard?scope=pipeline"),
    staleTime: 30 * 1000,
  });

  const activeDropdownFilters =
    (source !== ALL ? 1 : 0) +
    (salesOwnerId !== ALL ? 1 : 0) +
    (stage !== ALL ? 1 : 0) +
    (category !== ALL ? 1 : 0);
  const hasFilters =
    search !== "" ||
    source !== ALL ||
    salesOwnerId !== ALL ||
    stage !== ALL ||
    category !== ALL;
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / (data.pageSize || PAGE_SIZE)))
    : 1;

  // After delete/filter, avoid staying on an empty trailing page.
  useEffect(() => {
    if (!data) return;
    if (page > totalPages) setPage(totalPages);
  }, [data, page, totalPages]);

  const canSelect = canCreate || canDelete;
  const selectablePageIds =
    data?.items
      .filter((customer) => canSelect && (!customer.isConverted || canDelete))
      .map((item) => item.id) ?? [];
  const {
    selectedIds,
    selectedCount,
    selectAllState,
    toggleRow,
    toggleAllOnPage,
    clearSelection,
    removeIds,
  } = useCustomerSelection(selectablePageIds);

  const isRowSelectable = (customer: CrmCustomer) =>
    canSelect && (!customer.isConverted || canDelete);

  const transferMutation = useMutation({
    mutationFn: (ids: string[]) =>
      apiPost<CrmTransferResult>("/crm/customers/transfer", { ids }),
    onSuccess: async (result) => {
      const transferred = result.transferred.length;
      const already = result.alreadyTransferred.length;
      const skipped = result.skipped.length;
      const failed = result.failed.length;
      const parts: string[] = [];
      if (transferred === 1) parts.push(crmSalesText("transferSuccess"));
      else if (transferred > 1) {
        parts.push(
          crmSalesText("transferSuccessMany", {
            count: transferred.toLocaleString("fa-AF", {
              numberingSystem: "latn",
            }),
          }),
        );
      }
      if (already) {
        parts.push(
          crmSalesText("transferAlready", {
            count: already.toLocaleString("fa-AF", { numberingSystem: "latn" }),
          }),
        );
      }
      if (skipped) {
        parts.push(
          crmSalesText("transferSkipped", {
            count: skipped.toLocaleString("fa-AF", { numberingSystem: "latn" }),
          }),
        );
      }
      if (failed) {
        const first = result.failed[0]?.message;
        parts.push(first || crmSalesText("transferFailed"));
      }
      if (transferred || already) toast.success(parts.join(" "));
      else toast.error(parts.join(" ") || crmSalesText("transferFailed"));

      clearSelection();
      setTransferOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["crm-customers"] }),
        queryClient.invalidateQueries({ queryKey: ["crm-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
    },
    onError: (err) => {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : crmSalesText("transferFailed");
      toast.error(message || crmSalesText("transferFailed"));
    },
  });

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

  const openInvoice = (customer: CrmCustomer) => {
    setInvoiceCustomer(customer);
  };

  const openInvoiceList = (customer: CrmCustomer) => {
    setOpenedInvoiceId(null);
    setInvoicesCustomer(customer);
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setSource(ALL);
    setSalesOwnerId(ALL);
    setStage(ALL);
    setCategory(ALL);
    setPage(1);
  };

  const clearDropdownFilters = () => {
    setSource(ALL);
    setSalesOwnerId(ALL);
    setStage(ALL);
    setCategory(ALL);
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
    if (isSalesUser) return null;
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

  function renderStageSelect(triggerClassName?: string) {
    return (
      <Select
        value={stage}
        onValueChange={(value) => {
          setStage(value);
          setPage(1);
        }}
      >
        <SelectTrigger className={triggerClassName ?? "w-full sm:w-44"}>
          <SelectValue placeholder="وضعیت" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>همه وضعیت‌ها</SelectItem>
          {Object.entries(STAGE_LABELS)
            .filter(
              ([code]) =>
                !["INTERESTED", "PRICE_SENT", "COMPLETED", "CANCELED"].includes(
                  code,
                ),
            )
            .map(([code, label]) => (
              <SelectItem key={code} value={code}>
                {label}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    );
  }

  function renderCategorySelect(triggerClassName?: string) {
    return (
      <Select
        value={category}
        onValueChange={(value) => {
          setCategory(value);
          setPage(1);
        }}
      >
        <SelectTrigger className={triggerClassName ?? "w-full sm:w-44"}>
          <SelectValue placeholder="دسته‌بندی" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>همه دسته‌ها</SelectItem>
          {Object.entries(CATEGORY_LABELS).map(([code, label]) => (
            <SelectItem key={code} value={code}>
              {label}
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
          placeholder="جستجو بر اساس شناسه مشتری، نام، شرکت یا واتساپ..."
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
        title={crmSalesText("pageTitle")}
        subtitle={crmSalesText("pageSubtitle")}
        actions={
          canCreate ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setTransferOpen(true)}
                disabled={selectedCount === 0 || transferMutation.isPending}
                className="h-9 shrink-0 gap-1.5 px-3 text-sm sm:h-10 sm:px-4"
              >
                <Send className="h-4 w-4" />
                <span className="whitespace-nowrap">
                  {crmSalesText("transferToCustomers")}
                </span>
              </Button>
              <Button
                variant="brand"
                onClick={openCreate}
                className="h-9 shrink-0 gap-1.5 px-3 text-sm sm:h-10 sm:px-4"
              >
                <Plus className="h-4 w-4" />
                <span className="whitespace-nowrap">
                  {crmSalesText("newLead")}
                </span>
              </Button>
            </div>
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
        onDeleted={(id) => removeIds([id])}
      />
      <BulkDeleteCustomersDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        ids={[...selectedIds]}
        onDeleted={removeIds}
      />
      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        selectedCount={selectedCount}
        pending={transferMutation.isPending}
        onConfirm={() => {
          if (!selectedCount) {
            toast.error(crmSalesText("transferNoneSelected"));
            return;
          }
          transferMutation.mutate([...selectedIds]);
        }}
      />
      <InvoiceCreateDialog
        open={Boolean(invoiceCustomer)}
        onOpenChange={(next) => {
          if (!next) setInvoiceCustomer(null);
        }}
        customer={invoiceCustomer}
        onCreated={({ invoice, customer }) => {
          setOpenedInvoiceId(invoice.id);
          setInvoicesCustomer(customer);
        }}
      />
      <CrmInvoicesDialog
        open={Boolean(invoicesCustomer)}
        onOpenChange={(next) => {
          if (!next) {
            setInvoicesCustomer(null);
            setOpenedInvoiceId(null);
          }
        }}
        customer={invoicesCustomer}
        initialInvoiceId={openedInvoiceId}
      />

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
        >
          <SheetHeader className="text-start">
            <SheetTitle>فیلترها</SheetTitle>
            <SheetDescription>
              منبع ورود و مسئول فروش را انتخاب کنید. فیلترها بلافاصله اعمال
              می‌شوند.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">وضعیت قیف</p>
              {renderStageSelect("w-full")}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">دسته‌بندی</p>
              {renderCategorySelect("w-full")}
            </div>
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
        <CrmDashboardStats
          stats={dashboard}
          loading={dashboardLoading}
          selectedCategory={category === ALL ? undefined : category}
          onSelectCategory={(code) => {
            setCategory((current) => (current === code ? ALL : code));
            setPage(1);
          }}
        />
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
            {data.total.toLocaleString("fa-AF", { numberingSystem: "latn" })}{" "}
            مشتری
            {selectedCount > 0
              ? ` · ${crmSalesText("selectedCount", {
                  count: selectedCount.toLocaleString("fa-AF", {
                    numberingSystem: "latn",
                  }),
                })}`
              : ""}
          </p>
        )}

        {/* Desktop / tablet: inline filters */}
        <div className="hidden items-center gap-2 md:flex">
          {renderSearchField()}
          {renderStageSelect()}
          {renderCategorySelect()}
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
              {data.total.toLocaleString("fa-AF", { numberingSystem: "latn" })}{" "}
              مشتری
              {selectedCount > 0 ? (
                <span className="ms-2 text-foreground">
                  ·{" "}
                  {crmSalesText("selectedCount", {
                    count: selectedCount.toLocaleString("fa-AF", {
                      numberingSystem: "latn",
                    }),
                  })}
                </span>
              ) : null}
            </p>
          )}
        </div>

        <CrmSelectionBar
          className="md:hidden"
          selectedCount={selectedCount}
          selectedLabel={crmSalesText("selectedCount", {
            count: selectedCount.toLocaleString("fa-AF", {
              numberingSystem: "latn",
            }),
          })}
          canDelete={canDelete}
          bulkDeleteLabel={crmSalesText("bulkDelete")}
          clearLabel={crmSalesText("clearSelection")}
          onBulkDelete={() => setBulkDeleteOpen(true)}
          onClear={clearSelection}
        />

        {isLoading && <LoadingTable columns={6} />}

        {error && (
          <EmptyState
            title="بارگذاری مشتریان ناموفق بود"
            description="لطفاً اتصال خود را بررسی کرده و دوباره تلاش کنید."
          />
        )}

        {data && data.items.length === 0 && (
          <EmptyState
            title={hasFilters ? "نتیجه‌ای یافت نشد" : "سرنخ ثبت نشده است"}
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
                  {crmSalesText("newLead")}
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
              <Table className="min-w-[72rem]">
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="sticky top-0 z-[1] w-10 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                      <Checkbox
                        checked={selectAllState}
                        onCheckedChange={(value) =>
                          toggleAllOnPage(value === true)
                        }
                        aria-label={crmSalesText("selectAll")}
                        disabled={!canSelect || selectablePageIds.length === 0}
                      />
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                      {crmSalesText("customerId")}
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                      {crmSalesText("customer")}
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                      {crmSalesText("contact")}
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] whitespace-nowrap bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                      {crmSalesText("statusColumn")}
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] whitespace-nowrap bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                      {crmSalesText("category")}
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] whitespace-nowrap bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                      {crmSalesText("source")}
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] whitespace-nowrap bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                      {crmSalesText("salesOwner")}
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] whitespace-nowrap bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                      {crmSalesText("lastContact")}
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] w-14 bg-muted/95 text-center backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                      {crmSalesText("actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((customer) => (
                    <TableRow
                      key={customer.id}
                      data-state={
                        selectedIds.has(customer.id) ? "selected" : undefined
                      }
                    >
                      <TableCell
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={selectedIds.has(customer.id)}
                          onCheckedChange={(value) =>
                            toggleRow(customer.id, value === true)
                          }
                          aria-label={crmSalesText("selectRow")}
                          disabled={!isRowSelectable(customer)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs" dir="ltr">
                        {customer.customerCode || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="min-w-[8rem] font-medium">
                          {customer.personName}
                          {customer.companyName && (
                            <span className="block text-xs font-normal text-muted-foreground">
                              {customer.companyName}
                            </span>
                          )}
                          <CustomerManagementIndicator customer={customer} />
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
                      <TableCell className="whitespace-nowrap">
                        <CustomerStatusSelect
                          customer={customer}
                          canEdit={canEdit}
                          role={me?.role}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {customer.category ? (
                          <Badge
                            variant={categoryBadgeVariant(customer.category)}
                          >
                            {customer.categoryLabel ||
                              CATEGORY_LABELS[customer.category] ||
                              crmSalesText("category")}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatLeadSource(customer.source)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {customer.salesOwner?.fullName || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(
                          customer.lastContactAt || customer.createdAt,
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <CustomerActions
                          customer={customer}
                          onEdit={openEdit}
                          onDelete={openDelete}
                          onCreateInvoice={openInvoice}
                          onViewInvoices={openInvoiceList}
                          canEdit={canEdit}
                          canDelete={canDelete}
                          canInvoice={canInvoice}
                          canTransfer={canCreate}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </HorizontalScroll>

            <TablePagination
              page={page}
              pageSize={data.pageSize || PAGE_SIZE}
              total={data.total}
              onPageChange={setPage}
              isFetching={isFetching}
            />
          </>
        )}
      </div>
    </div>
  );
}
