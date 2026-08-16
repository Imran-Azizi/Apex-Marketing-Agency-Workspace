"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  Loader2,
  Search,
  ShieldCheck,
} from "lucide-react";
import { apiGet, apiPut } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export type PermissionAction = {
  code: string;
  label: string;
  description?: string;
};

export type PermissionModule = {
  id: string;
  label: string;
  description?: string;
  actions: PermissionAction[];
};

export type EmployeePermissionDetail = {
  employee: {
    id: string;
    fullName: string;
    email: string;
    isActive: boolean;
    role: { code: string; name: string };
  };
  catalog: PermissionModule[];
  roleDefaults: string[];
  effective: string[];
  totalPermissions: number;
  enabledCount: number;
  disabledCount: number;
  locked: boolean;
  lockedMessage?: string | null;
  canManage: boolean;
};

const ROLE_LABELS: Record<string, string> = {
  MANAGER: "مدیر",
  ADMIN: "ادمین",
  SALES: "فروش",
  EDITOR: "ادیتور",
  NARRATOR: "نریتور",
  FINANCE: "مالی",
};

interface ManagePermissionsDialogProps {
  employeeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManagePermissionsDialog({
  employeeId,
  open,
  onOpenChange,
}: ManagePermissionsDialogProps) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const detailQ = useQuery({
    queryKey: ["permission-employee", employeeId],
    queryFn: () =>
      apiGet<EmployeePermissionDetail>(`/permissions/employees/${employeeId}`),
    enabled: open && !!employeeId,
  });

  const detail = detailQ.data;

  useEffect(() => {
    if (!detail) return;
    setSelected(new Set(detail.effective));
    // Categories stay collapsed until the manager opens them.
    setExpanded(new Set());
    setQuery("");
    setConfirmOpen(false);
  }, [detail]);

  const catalog = detail?.catalog || [];
  const roleDefaults = useMemo(
    () => new Set(detail?.roleDefaults || []),
    [detail],
  );

  const searchQuery = query.trim().toLowerCase();
  const isSearching = searchQuery.length > 0;

  const filteredCatalog = useMemo(() => {
    if (!isSearching) return catalog;
    return catalog
      .map((mod) => ({
        ...mod,
        actions: mod.actions.filter(
          (action) =>
            action.label.toLowerCase().includes(searchQuery) ||
            (action.description || "").toLowerCase().includes(searchQuery) ||
            mod.label.toLowerCase().includes(searchQuery) ||
            (mod.description || "").toLowerCase().includes(searchQuery),
        ),
      }))
      .filter((mod) => mod.actions.length > 0);
  }, [catalog, isSearching, searchQuery]);

  const allCodes = useMemo(
    () => catalog.flatMap((mod) => mod.actions.map((a) => a.code)),
    [catalog],
  );

  const enabledCount = selected.size;
  const disabledCount = Math.max(0, (detail?.totalPermissions || 0) - enabledCount);
  const dirty = useMemo(() => {
    const current = new Set(detail?.effective || []);
    if (current.size !== selected.size) return true;
    for (const code of selected) if (!current.has(code)) return true;
    return false;
  }, [detail, selected]);

  const added = useMemo(() => {
    const prev = new Set(detail?.effective || []);
    return [...selected].filter((code) => !prev.has(code));
  }, [detail, selected]);

  const removed = useMemo(() => {
    const prev = detail?.effective || [];
    return prev.filter((code) => !selected.has(code));
  }, [detail, selected]);

  const saveMut = useMutation({
    mutationFn: () =>
      apiPut<EmployeePermissionDetail>(`/permissions/employees/${employeeId}`, {
        codes: [...selected],
      }),
    onSuccess: () => {
      toast.success("دسترسی‌های کارمند ذخیره شد");
      qc.invalidateQueries({ queryKey: ["permission-employees"] });
      qc.invalidateQueries({ queryKey: ["permission-employee", employeeId] });
      qc.invalidateQueries({ queryKey: ["me"] });
      setConfirmOpen(false);
      onOpenChange(false);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "ذخیره دسترسی‌ها ناموفق بود"),
  });

  function toggle(code: string, next: boolean) {
    setSelected((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(code);
      else copy.delete(code);
      return copy;
    });
  }

  function setModule(mod: PermissionModule, next: boolean) {
    setSelected((prev) => {
      const copy = new Set(prev);
      for (const action of mod.actions) {
        if (next) copy.add(action.code);
        else copy.delete(action.code);
      }
      return copy;
    });
  }

  function handleClose(next: boolean) {
    if (!next && dirty && !saveMut.isPending) {
      const ok = window.confirm("تغییرات ذخیره نشده‌اند. خارج می‌شوید؟");
      if (!ok) return;
    }
    if (!next) onOpenChange(false);
  }

  const locked = !!detail && (!detail.canManage || detail.locked);

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent
          dir="rtl"
          className="flex max-h-[92vh] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 text-start sm:max-w-3xl"
        >
          <DialogHeader className="space-y-1 border-b border-border/60 px-5 py-4 text-start">
            <DialogTitle className="flex items-center gap-2 text-start text-base">
              <ShieldCheck className="h-5 w-5 shrink-0 text-brand" />
              مدیریت دسترسی‌ها
            </DialogTitle>
            <DialogDescription>
              {detail ? (
                <span>
                  {detail.employee.fullName}
                  <span className="mx-1 text-muted-foreground">·</span>
                  {ROLE_LABELS[detail.employee.role.code] || detail.employee.role.code}
                </span>
              ) : (
                "بارگذاری دسترسی‌های کارمند"
              )}
            </DialogDescription>
          </DialogHeader>

          {detailQ.isLoading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          ) : null}

          {detailQ.error ? (
            <p className="px-5 py-8 text-sm text-destructive">
              بارگذاری دسترسی‌ها ناموفق بود
            </p>
          ) : null}

          {detail ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="grid grid-cols-3 gap-2 border-b border-border/60 bg-muted/20 px-5 py-3">
                <Counter label="کل دسترسی‌ها" value={detail.totalPermissions} />
                <Counter label="فعال" value={enabledCount} tone="success" />
                <Counter label="غیرفعال" value={disabledCount} />
              </div>

              <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-5 py-3">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    dir="rtl"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="جستجوی ماژول یا نام دسترسی..."
                    className="h-9 ps-9 text-start"
                    disabled={locked}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={locked}
                  onClick={() => setSelected(new Set(allCodes))}
                >
                  انتخاب همه
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={locked}
                  onClick={() => setSelected(new Set())}
                >
                  پاک کردن همه
                </Button>
              </div>

              {locked && detail.lockedMessage ? (
                <p className="mx-5 mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {detail.lockedMessage}
                </p>
              ) : null}

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
                {filteredCatalog.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    موردی مطابق جستجو پیدا نشد
                  </p>
                ) : (
                  filteredCatalog.map((mod) => {
                    // While searching, expand matches so results are visible;
                    // otherwise respect the manager's accordion state (collapsed by default).
                    const openMod = isSearching || expanded.has(mod.id);
                    const moduleCodes = mod.actions.map((a) => a.code);
                    const enabledInMod = moduleCodes.filter((c) =>
                      selected.has(c),
                    ).length;
                    const allOn =
                      moduleCodes.length > 0 &&
                      enabledInMod === moduleCodes.length;
                    const panelId = `perm-panel-${mod.id}`;
                    const headerId = `perm-header-${mod.id}`;
                    return (
                      <section
                        key={mod.id}
                        className={cn(
                          "overflow-hidden rounded-xl border bg-card transition-colors",
                          openMod
                            ? "border-border shadow-sm"
                            : "border-border/70",
                        )}
                      >
                        <header className="flex items-center gap-2 px-3 py-2.5">
                          <button
                            type="button"
                            id={headerId}
                            aria-expanded={openMod}
                            aria-controls={panelId}
                            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-0.5 text-start transition-colors hover:bg-muted/50"
                            onClick={() =>
                              setExpanded((prev) => {
                                const copy = new Set(prev);
                                if (copy.has(mod.id)) copy.delete(mod.id);
                                else copy.add(mod.id);
                                return copy;
                              })
                            }
                          >
                            <span
                              className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/40",
                                openMod && "border-brand/30 bg-brand/10",
                              )}
                              aria-hidden
                            >
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                                  openMod && "text-brand",
                                  !openMod && "-rotate-90 rtl:rotate-90",
                                )}
                              />
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">{mod.label}</p>
                              {mod.description ? (
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {mod.description}
                                </p>
                              ) : null}
                            </div>
                          </button>
                          <Badge variant="secondary" className="font-normal tabular-nums">
                            {enabledInMod}/{moduleCodes.length}
                          </Badge>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs"
                            disabled={locked}
                            onClick={() => setModule(mod, !allOn)}
                          >
                            {allOn ? "پاک کردن" : "همه"}
                          </Button>
                        </header>
                        {openMod ? (
                          <ul
                            id={panelId}
                            role="region"
                            aria-labelledby={headerId}
                            className="space-y-1 border-t border-border/60 px-3 py-2"
                          >
                            {mod.actions.map((action) => {
                              const checked = selected.has(action.code);
                              const inherited = roleDefaults.has(action.code);
                              const inputId = `perm-${employeeId}-${action.code}`;
                              return (
                                <li
                                  key={action.code}
                                  className="flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/40"
                                >
                                  <Checkbox
                                    checked={checked}
                                    disabled={locked}
                                    onCheckedChange={(value) =>
                                      toggle(action.code, value === true)
                                    }
                                    className="mt-0.5"
                                    id={inputId}
                                  />
                                  <label
                                    htmlFor={inputId}
                                    className="min-w-0 flex-1 cursor-pointer text-start"
                                  >
                                    <span className="flex flex-wrap items-center gap-2">
                                      <span className="text-sm font-medium">
                                        {action.label}
                                      </span>
                                      {inherited && checked ? (
                                        <Badge
                                          variant="outline"
                                          className="h-5 px-1.5 text-[10px] font-normal"
                                        >
                                          پیش‌فرض نقش
                                        </Badge>
                                      ) : null}
                                      {!inherited && checked ? (
                                        <Badge
                                          variant="brand"
                                          className="h-5 px-1.5 text-[10px] font-normal"
                                        >
                                          اعطاشده
                                        </Badge>
                                      ) : null}
                                      {inherited && !checked ? (
                                        <Badge
                                          variant="warning"
                                          className="h-5 px-1.5 text-[10px] font-normal"
                                        >
                                          سلب‌شده
                                        </Badge>
                                      ) : null}
                                    </span>
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </section>
                    );
                  })
                )}
              </div>

              <DialogFooter className="gap-2 border-t border-border/60 px-5 py-3 sm:justify-start">
                <Button
                  variant="brand"
                  disabled={locked || !dirty || saveMut.isPending}
                  onClick={() => setConfirmOpen(true)}
                  className="gap-2"
                >
                  {saveMut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  ذخیره تغییرات
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleClose(false)}
                  disabled={saveMut.isPending}
                >
                  انصراف
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent dir="rtl" className="text-start sm:max-w-md">
          <DialogHeader className="text-start">
            <DialogTitle>تأیید تغییر دسترسی‌ها</DialogTitle>
            <DialogDescription>
              این تغییر بلافاصله روی ورود بعدی و درخواست‌های API اعمال می‌شود.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              دسترسی‌های جدید:{" "}
              <span className="font-semibold text-success">{added.length}</span>
            </p>
            <p>
              دسترسی‌های حذف‌شده:{" "}
              <span className="font-semibold text-destructive">
                {removed.length}
              </span>
            </p>
          </div>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              variant="brand"
              disabled={saveMut.isPending}
              onClick={() => saveMut.mutate()}
              className="gap-2"
            >
              {saveMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              تأیید و ذخیره
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={saveMut.isPending}
            >
              بازگشت
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Counter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success";
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background px-3 py-2 text-start">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-lg font-semibold tabular-nums",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </p>
    </div>
  );
}
