"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiDelete, apiGet, apiPost, ensureCsrf, API_BASE } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { HorizontalScroll } from "@/components/shared/horizontal-scroll";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  CalendarClock,
  CheckCircle2,
  Download,
  HardDrive,
  HardDriveDownload,
  Loader2,
  Mail,
  RefreshCcw,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

type BackupType = "MANUAL" | "AUTOMATIC";
type BackupStatus = "PROCESSING" | "SUCCESS" | "FAILED";

interface SystemBackup {
  id: string;
  type: BackupType;
  status: BackupStatus;
  fileName: string | null;
  storageKey: string | null;
  sizeBytes: number;
  checksum: string | null;
  tableCount: number;
  recordCount: number;
  errorMessage: string | null;
  emailTo: string | null;
  emailSentAt: string | null;
  completedAt: string | null;
  createdAt: string;
  createdBy?: { id: string; fullName: string; email: string } | null;
}

interface ScheduleConfig {
  emailTo: string;
  daily: { enabled: boolean; time: string };
  weekly: { enabled: boolean; dayOfWeek: number; time: string };
  monthly: { enabled: boolean; dayOfMonth: number; time: string };
}

interface Overview {
  schedule: ScheduleConfig;
  nextRuns: { daily?: string; weekly?: string; monthly?: string };
  emailConfigured: boolean;
  latest: SystemBackup | null;
  stats: {
    total: number;
    success: number;
    failed: number;
    processing: number;
  };
}

interface BackupList {
  items: SystemBackup[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const DAY_LABELS = [
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
  "شنبه",
];

function formatSize(bytes: number) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function StatusBadge({ status }: { status: BackupStatus }) {
  if (status === "SUCCESS") {
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle2 className="h-3 w-3" />
        موفق
      </Badge>
    );
  }
  if (status === "FAILED") {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" />
        ناموفق
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Loader2 className="h-3 w-3 animate-spin" />
      در حال پردازش
    </Badge>
  );
}

function TypeBadge({ type }: { type: BackupType }) {
  return (
    <Badge variant={type === "MANUAL" ? "outline" : "secondary"}>
      {type === "MANUAL" ? "دستی" : "خودکار"}
    </Badge>
  );
}

async function downloadBackupFile(id: string, fileName: string | null) {
  await ensureCsrf();
  const res = await fetch(`${API_BASE}/backup/${id}/download`, {
    method: "GET",
    credentials: "include",
    headers: {
      "X-APEX-Panel": "manager",
    },
  });
  if (!res.ok) {
    let message = "دانلود ناموفق بود";
    try {
      const json = await res.json();
      message = json?.error?.message || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || `apex-backup-${id}.json.gz`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function BackupPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleConfig | null>(
    null,
  );
  const [pendingBackupId, setPendingBackupId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<SystemBackup | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<SystemBackup | null>(null);
  const [uploadMeta, setUploadMeta] = useState<{
    file: File;
    info: {
      tableCount: number;
      recordCount: number;
      createdAt: string;
    };
  } | null>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);

  const overview = useQuery({
    queryKey: ["backup-overview"],
    queryFn: () => apiGet<Overview>("/backup/overview"),
  });

  const list = useQuery({
    queryKey: ["backup-list", page, typeFilter, statusFilter, search],
    queryFn: () =>
      apiGet<BackupList>(
        `/backup?page=${page}&pageSize=10&type=${typeFilter}&status=${statusFilter}&search=${encodeURIComponent(search)}`,
      ),
    refetchInterval: (q) =>
      q.state.data?.items?.some((i) => i.status === "PROCESSING") ? 2000 : false,
  });

  useEffect(() => {
    if (overview.data?.schedule && !scheduleDraft) {
      setScheduleDraft(overview.data.schedule);
    }
  }, [overview.data, scheduleDraft]);

  // Poll a newly created backup until complete
  useEffect(() => {
    if (!pendingBackupId) return;
    let cancelled = false;
    let ticks = 0;
    const id = setInterval(async () => {
      ticks += 1;
      setProgress((p) => Math.min(92, p + 7));
      try {
        const row = await apiGet<SystemBackup>(`/backup/${pendingBackupId}`);
        if (cancelled) return;
        if (row.status === "SUCCESS" || row.status === "FAILED") {
          setProgress(100);
          clearInterval(id);
          setPendingBackupId(null);
          qc.invalidateQueries({ queryKey: ["backup-list"] });
          qc.invalidateQueries({ queryKey: ["backup-overview"] });
          if (row.status === "SUCCESS") {
            toast.success("پشتیبان با موفقیت ایجاد شد");
          } else {
            toast.error(row.errorMessage || "ایجاد پشتیبان ناموفق بود");
          }
          setTimeout(() => setProgress(0), 800);
        }
      } catch {
        /* keep polling briefly */
      }
      if (ticks > 90) {
        clearInterval(id);
        setPendingBackupId(null);
        setProgress(0);
      }
    }, 1500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pendingBackupId, qc]);

  const createMut = useMutation({
    mutationFn: () => apiPost<SystemBackup>("/backup", {}),
    onSuccess: (row) => {
      setProgress(8);
      setPendingBackupId(row.id);
      toast.message("پشتیبان‌گیری شروع شد", {
        description: "در حال آماده‌سازی و ارسال به ایمیل…",
      });
      qc.invalidateQueries({ queryKey: ["backup-list"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "خطا در ایجاد پشتیبان"),
  });

  const saveScheduleMut = useMutation({
    mutationFn: async (body: ScheduleConfig) => {
      await ensureCsrf();
      const { data } = await api.put("/backup/schedule", body);
      if (!data?.success) {
        throw new Error(data?.error?.message || "ذخیره زمان‌بندی ناموفق بود");
      }
      return data.data;
    },
    onSuccess: (data: { schedule?: ScheduleConfig } | undefined) => {
      toast.success("زمان‌بندی ذخیره شد");
      if (data?.schedule) setScheduleDraft(data.schedule);
      else setScheduleDraft(null);
      qc.invalidateQueries({ queryKey: ["backup-overview"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "ذخیره زمان‌بندی ناموفق بود"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/backup/${id}`),
    onSuccess: () => {
      toast.success("پشتیبان حذف شد");
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["backup-list"] });
      qc.invalidateQueries({ queryKey: ["backup-overview"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "حذف ناموفق بود"),
  });

  const restoreMut = useMutation({
    mutationFn: async () => {
      await ensureCsrf();
      if (restoreTarget) {
        return apiPost(`/backup/${restoreTarget.id}/restore`, {
          confirm: true,
        });
      }
      if (uploadMeta) {
        const form = new FormData();
        form.append("file", uploadMeta.file);
        form.append("confirm", "true");
        const { data } = await api.post("/backup/restore-upload", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        if (!data?.success) {
          throw new Error(data?.error?.message || "بازگردانی ناموفق بود");
        }
        return data.data;
      }
      throw new Error("منبع بازگردانی مشخص نیست");
    },
    onSuccess: () => {
      toast.success("بازگردانی با موفقیت انجام شد");
      setRestoreConfirmOpen(false);
      setRestoreTarget(null);
      setUploadMeta(null);
      qc.invalidateQueries({ queryKey: ["backup-list"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "بازگردانی ناموفق بود"),
  });

  const validateUploadMut = useMutation({
    mutationFn: async (file: File) => {
      await ensureCsrf();
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post("/backup/validate-upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (!data?.success) {
        throw new Error(data?.error?.message || "فایل نامعتبر است");
      }
      return data.data as {
        tableCount: number;
        recordCount: number;
        createdAt: string;
      };
    },
    onSuccess: (info, file) => {
      setUploadMeta({ file, info });
      toast.success("فایل پشتیبان معتبر است");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "اعتبارسنجی ناموفق بود"),
  });

  const schedule = scheduleDraft || overview.data?.schedule;
  const nextRuns = overview.data?.nextRuns;

  const nextRunLabel = useMemo(() => {
    if (!nextRuns) return null;
    const entries = Object.entries(nextRuns).filter(([, v]) => v);
    if (!entries.length) return "زمان‌بندی فعالی تنظیم نشده";
    return entries
      .map(([k, v]) => {
        const label =
          k === "daily" ? "روزانه" : k === "weekly" ? "هفتگی" : "ماهانه";
        return `${label}: ${formatDateTime(v as string)}`;
      })
      .join(" · ");
  }, [nextRuns]);

  return (
    <div className="space-y-6 animate-fade-slide" dir="rtl">
      <PageHeader
        title="پشتیبان‌گیری و بازگردانی"
        subtitle="ایجاد، زمان‌بندی، دانلود و بازگردانی امن نسخه‌های پشتیبان سیستم"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "کل پشتیبان‌ها",
            value: overview.data?.stats.total ?? "—",
            tone: "brand",
          },
          {
            label: "موفق",
            value: overview.data?.stats.success ?? "—",
            tone: "success",
          },
          {
            label: "ناموفق",
            value: overview.data?.stats.failed ?? "—",
            tone: "danger",
          },
          {
            label: "در حال پردازش",
            value: overview.data?.stats.processing ?? "—",
            tone: "warning",
          },
        ].map((s) => (
          <Card key={s.label} className="border-border/60 shadow-sm">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{s.value}</p>
              </div>
              <HardDrive className="h-8 w-8 text-brand/70" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Create backup */}
        <Card className="border-brand/20 bg-gradient-to-bl from-brand/[0.06] via-card to-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDriveDownload className="h-5 w-5 text-brand" />
              ایجاد پشتیبان جدید
            </CardTitle>
            <CardDescription>
              نسخه کامل داده‌های سیستم (دیتابیس، کاربران، مشتریان، پروژه‌ها، مالی و
              تنظیمات) ساخته شده و به ایمیل پیکربندی‌شده ارسال می‌شود.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {overview.data?.latest ? (
              <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                <p className="font-medium">آخرین پشتیبان موفق</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-muted-foreground">
                  <span>{formatDateTime(overview.data.latest.createdAt)}</span>
                  <span aria-hidden>·</span>
                  <span>{formatSize(overview.data.latest.sizeBytes)}</span>
                  <span aria-hidden>·</span>
                  <TypeBadge type={overview.data.latest.type} />
                </div>
              </div>
            ) : null}

            {(pendingBackupId || progress > 0) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>پیشرفت پشتیبان‌گیری</span>
                  <span className="tabular-nums">{progress}٪</span>
                </div>
                <Progress value={progress} />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />
              {overview.data?.emailConfigured
                ? `ایمیل فعال · گیرنده: ${overview.data.schedule.emailTo || "پیش‌فرض سیستم"}`
                : "SMTP پیکربندی نشده — فایل فقط در فضای ذخیره ذخیره می‌شود"}
            </div>

            <Button
              variant="brand"
              size="lg"
              className="w-full rounded-xl sm:w-auto"
              disabled={createMut.isPending || !!pendingBackupId}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending || pendingBackupId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <HardDrive className="h-4 w-4" />
              )}
              ایجاد پشتیبان اکنون
            </Button>
          </CardContent>
        </Card>

        {/* Restore */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RotateCcw className="h-5 w-5 text-brand" />
              بازگردانی از پشتیبان
            </CardTitle>
            <CardDescription>
              فایل پشتیبان را بارگذاری کنید. قبل از بازگردانی، اعتبارسنجی و تأیید
              امنیتی انجام می‌شود.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileRef}
              type="file"
              accept=".gz,.json,application/gzip,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) validateUploadMut.mutate(file);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              className="w-full rounded-xl"
              disabled={validateUploadMut.isPending}
              onClick={() => fileRef.current?.click()}
            >
              {validateUploadMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              انتخاب فایل پشتیبان
            </Button>

            {uploadMeta ? (
              <div className="space-y-3 rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-3 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <p className="font-medium text-emerald-800 dark:text-emerald-200">
                  فایل معتبر است
                </p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>نام: {uploadMeta.file.name}</li>
                  <li>جداول: {uploadMeta.info.tableCount}</li>
                  <li>رکوردها: {uploadMeta.info.recordCount}</li>
                  <li>
                    تاریخ پشتیبان: {formatDateTime(uploadMeta.info.createdAt)}
                  </li>
                </ul>
                <Button
                  variant="brand"
                  className="w-full rounded-xl"
                  onClick={() => {
                    setRestoreTarget(null);
                    setRestoreConfirmOpen(true);
                  }}
                >
                  ادامه بازگردانی
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Scheduler */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-5 w-5 text-brand" />
            زمان‌بندی پشتیبان خودکار
          </CardTitle>
          <CardDescription>
            {nextRunLabel || "در حال بارگذاری…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!schedule || overview.isLoading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : (
            <>
              <div className="max-w-md space-y-2">
                <Label htmlFor="backup-email">ایمیل دریافت پشتیبان</Label>
                <Input
                  id="backup-email"
                  dir="ltr"
                  type="email"
                  placeholder="backup@company.com"
                  value={schedule.emailTo || ""}
                  onChange={(e) =>
                    setScheduleDraft({
                      ...schedule,
                      emailTo: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {/* Daily */}
                <div className="rounded-2xl border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">روزانه</p>
                    <Checkbox
                      checked={schedule.daily.enabled}
                      onCheckedChange={(c) =>
                        setScheduleDraft({
                          ...schedule,
                          daily: {
                            ...schedule.daily,
                            enabled: c === true,
                          },
                        })
                      }
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">هر روز در ساعت</p>
                  <Input
                    type="time"
                    dir="ltr"
                    value={schedule.daily.time}
                    disabled={!schedule.daily.enabled}
                    onChange={(e) =>
                      setScheduleDraft({
                        ...schedule,
                        daily: { ...schedule.daily, time: e.target.value },
                      })
                    }
                  />
                </div>

                {/* Weekly */}
                <div className="rounded-2xl border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">هفتگی</p>
                    <Checkbox
                      checked={schedule.weekly.enabled}
                      onCheckedChange={(c) =>
                        setScheduleDraft({
                          ...schedule,
                          weekly: {
                            ...schedule.weekly,
                            enabled: c === true,
                          },
                        })
                      }
                    />
                  </div>
                  <Select
                    value={String(schedule.weekly.dayOfWeek)}
                    disabled={!schedule.weekly.enabled}
                    onValueChange={(v) =>
                      setScheduleDraft({
                        ...schedule,
                        weekly: {
                          ...schedule.weekly,
                          dayOfWeek: Number(v),
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="روز هفته" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_LABELS.map((label, i) => (
                        <SelectItem key={label} value={String(i)}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="time"
                    dir="ltr"
                    value={schedule.weekly.time}
                    disabled={!schedule.weekly.enabled}
                    onChange={(e) =>
                      setScheduleDraft({
                        ...schedule,
                        weekly: { ...schedule.weekly, time: e.target.value },
                      })
                    }
                  />
                </div>

                {/* Monthly */}
                <div className="rounded-2xl border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">ماهانه</p>
                    <Checkbox
                      checked={schedule.monthly.enabled}
                      onCheckedChange={(c) =>
                        setScheduleDraft({
                          ...schedule,
                          monthly: {
                            ...schedule.monthly,
                            enabled: c === true,
                          },
                        })
                      }
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">روز ماه (۱–۲۸)</p>
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={schedule.monthly.dayOfMonth}
                    disabled={!schedule.monthly.enabled}
                    onChange={(e) =>
                      setScheduleDraft({
                        ...schedule,
                        monthly: {
                          ...schedule.monthly,
                          dayOfMonth: Number(e.target.value) || 1,
                        },
                      })
                    }
                  />
                  <Input
                    type="time"
                    dir="ltr"
                    value={schedule.monthly.time}
                    disabled={!schedule.monthly.enabled}
                    onChange={(e) =>
                      setScheduleDraft({
                        ...schedule,
                        monthly: {
                          ...schedule.monthly,
                          time: e.target.value,
                        },
                      })
                    }
                  />
                </div>
              </div>

              <Button
                variant="brand"
                className="rounded-xl"
                disabled={!scheduleDraft || saveScheduleMut.isPending}
                onClick={() => scheduleDraft && saveScheduleMut.mutate(scheduleDraft)}
              >
                {saveScheduleMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                ذخیره زمان‌بندی
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-base">تاریخچه پشتیبان‌ها</CardTitle>
            <CardDescription>
              دانلود، بازگردانی یا حذف نسخه‌های ذخیره‌شده
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="w-44 ps-8"
                placeholder="جستجو…"
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setPage(1);
                setTypeFilter(v);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="نوع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">همه انواع</SelectItem>
                <SelectItem value="MANUAL">دستی</SelectItem>
                <SelectItem value="AUTOMATIC">خودکار</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setPage(1);
                setStatusFilter(v);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="وضعیت" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
                <SelectItem value="SUCCESS">موفق</SelectItem>
                <SelectItem value="FAILED">ناموفق</SelectItem>
                <SelectItem value="PROCESSING">در حال پردازش</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                qc.invalidateQueries({ queryKey: ["backup-list"] });
                qc.invalidateQueries({ queryKey: ["backup-overview"] });
              }}
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {list.isLoading ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : !list.data?.items.length ? (
            <EmptyState
              title="هنوز پشتیبانی ثبت نشده"
              description="با دکمه «ایجاد پشتیبان اکنون» اولین نسخه را بسازید."
            />
          ) : (
            <>
              <HorizontalScroll className="rounded-xl">
                <Table className="min-w-[40rem]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>تاریخ و زمان</TableHead>
                      <TableHead>نوع</TableHead>
                      <TableHead>حجم</TableHead>
                      <TableHead>وضعیت</TableHead>
                      <TableHead>ایمیل</TableHead>
                      <TableHead className="w-[1%]">عملیات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.data.items.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDateTime(row.createdAt)}
                        </TableCell>
                        <TableCell>
                          <TypeBadge type={row.type} />
                        </TableCell>
                        <TableCell className="tabular-nums text-sm">
                          {row.sizeBytes ? formatSize(row.sizeBytes) : "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={row.status} />
                        </TableCell>
                        <TableCell className="max-w-[140px] truncate text-xs text-muted-foreground">
                          {row.emailSentAt
                            ? "ارسال شد"
                            : row.emailTo || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={row.status !== "SUCCESS"}
                              title="دانلود"
                              onClick={async () => {
                                try {
                                  await downloadBackupFile(row.id, row.fileName);
                                  toast.success("دانلود آغاز شد");
                                } catch (e) {
                                  toast.error(
                                    e instanceof Error
                                      ? e.message
                                      : "دانلود ناموفق",
                                  );
                                }
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={row.status !== "SUCCESS"}
                              title="بازگردانی"
                              onClick={() => {
                                setUploadMeta(null);
                                setRestoreTarget(row);
                                setRestoreConfirmOpen(true);
                              }}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="حذف"
                              onClick={() => setDeleteTarget(row)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </HorizontalScroll>

              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  صفحه {list.data.page} از {list.data.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    قبلی
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= list.data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    بعدی
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف پشتیبان</DialogTitle>
            <DialogDescription>
              این عمل فایل پشتیبان را برای همیشه حذف می‌کند و قابل بازگشت نیست.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              انصراف
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              {deleteMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore confirm */}
      <Dialog
        open={restoreConfirmOpen}
        onOpenChange={(o) => {
          if (!o) {
            setRestoreConfirmOpen(false);
            setRestoreTarget(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              تأیید بازگردانی داده
            </DialogTitle>
            <DialogDescription className="space-y-2 text-start">
              <span className="block">
                بازگردانی، داده‌های فعلی سیستم را با نسخه پشتیبان جایگزین می‌کند.
                این عملیات برگشت‌پذیر نیست.
              </span>
              <span className="block font-medium text-foreground">
                فقط مدیر مجاز است این کار را انجام دهد. قبل از ادامه، از وضعیت
                فعلی نسخه پشتیبان بگیرید.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setRestoreConfirmOpen(false)}
            >
              انصراف
            </Button>
            <Button
              variant="destructive"
              disabled={restoreMut.isPending}
              onClick={() => restoreMut.mutate()}
            >
              {restoreMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              تأیید و بازگردانی
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
