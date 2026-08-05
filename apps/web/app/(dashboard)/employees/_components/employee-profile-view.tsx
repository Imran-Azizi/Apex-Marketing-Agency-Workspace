"use client";

import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Briefcase,
  CalendarClock,
  CalendarPlus,
  Camera,
  ImagePlus,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Trash2,
  UserCheck,
  UserCog,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPatch, ApiError } from "@/lib/api";
import { formatDate, formatPhoneDisplay, cn } from "@/lib/utils";
import { filePreviewUrl, uploadFileWithProgress } from "@/lib/upload";
import { UPLOAD_PURPOSE } from "@/lib/media-manager";
import { UploadProgress } from "@/components/loading/upload-progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ROLE_BADGE_VARIANTS,
  ROLE_LABELS_FA,
  type Employee,
  type StaffRole,
} from "./types";

const TEAM_KIND_LABELS: Record<string, string> = {
  MANAGER: "مدیریت",
  SALES: "فروش",
  EDITOR: "ادیت",
  NARRATOR: "نریشن",
  FINANCE: "مالی",
};

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[parts.length - 1][0]}`;
}

interface EmployeeProfileViewProps {
  employee: Employee;
  currentUserId?: string | null;
  onBack: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onResetPassword: () => void;
}

export function EmployeeProfileView({
  employee,
  currentUserId,
  onBack,
  onEdit,
  onToggleStatus,
  onResetPassword,
}: EmployeeProfileViewProps) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadName, setUploadName] = useState("");

  const roleCode = employee.role.code as StaffRole;
  const roleLabel =
    ROLE_LABELS_FA[roleCode] || employee.role.name || employee.role.code;
  const isManagerRole =
    employee.role.code === "MANAGER" || employee.role.code === "ADMIN";
  const initials = getInitials(employee.fullName);
  const teamKindLabel = employee.teamProfile?.kind
    ? TEAM_KIND_LABELS[employee.teamProfile.kind] || employee.teamProfile.kind
    : null;

  const storedImageUrl = employee.profileImage
    ? filePreviewUrl(employee.profileImage)
    : null;
  const displayImageUrl = previewUrl || storedImageUrl;

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const invalidateCaches = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["employee", employee.id] }),
      queryClient.invalidateQueries({ queryKey: ["employees"] }),
      currentUserId === employee.id
        ? queryClient.invalidateQueries({ queryKey: ["me"] })
        : Promise.resolve(),
    ]);
  };

  const saveImageMut = useMutation({
    mutationFn: (profileImage: string | null) =>
      apiPatch<Employee>(`/employees/${employee.id}`, { profileImage }),
    onSuccess: async () => {
      await invalidateCaches();
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "ذخیره تصویر پروفایل ناموفق بود",
      );
    },
  });

  const busy = uploading || saveImageMut.isPending;

  const clearPreview = () => {
    setPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const onPickImage = async (file: File | undefined) => {
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      toast.error("فقط فایل‌های JPG، PNG یا WEBP مجاز هستند");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("حجم تصویر نباید بیشتر از ۵ مگابایت باشد");
      return;
    }

    const localUrl = URL.createObjectURL(file);
    clearPreview();
    setPreviewUrl(localUrl);

    try {
      setUploading(true);
      setUploadPct(0);
      setUploadName(file.name);
      const uploaded = await uploadFileWithProgress(
        file,
        {
          purpose: UPLOAD_PURPOSE.EMPLOYEE_PROFILE,
          userId: employee.id,
        },
        (percent) => setUploadPct(percent),
      );
      setUploadPct(100);
      await saveImageMut.mutateAsync(uploaded.key);
      toast.success("تصویر پروفایل به‌روزرسانی شد");
      clearPreview();
    } catch (err) {
      clearPreview();
      toast.error(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "آپلود تصویر ناموفق بود",
      );
    } finally {
      setUploading(false);
      setUploadPct(0);
      setUploadName("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onRemoveImage = async () => {
    if (!employee.profileImage && !previewUrl) return;
    try {
      clearPreview();
      await saveImageMut.mutateAsync(null);
      toast.success("تصویر پروفایل حذف شد");
    } catch {
      /* toast handled in mutation */
    }
  };

  return (
    <div dir="rtl" className="mx-auto w-full max-w-4xl">
      <Card className="overflow-hidden border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="relative h-28 overflow-hidden bg-gradient-to-l from-brand via-brand to-brand/75 sm:h-32">
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle at 18% 40%, rgba(255,255,255,0.28), transparent 42%), radial-gradient(circle at 82% 15%, rgba(255,255,255,0.16), transparent 38%)",
            }}
          />
        </div>

        <CardContent className="relative px-4 pb-6 pt-0 sm:px-6 sm:pb-7">
          <div className="-mt-14 flex flex-col gap-5 sm:-mt-16 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 flex-col items-start gap-4 sm:flex-row sm:items-end">
              <div className="relative shrink-0">
                <Avatar className="h-28 w-28 border-4 border-card shadow-lg shadow-brand/20 ring-1 ring-border/40 sm:h-32 sm:w-32">
                  {displayImageUrl ? (
                    <AvatarImage
                      src={displayImageUrl}
                      alt={employee.fullName}
                      className="object-cover"
                    />
                  ) : null}
                  <AvatarFallback className="bg-gradient-to-bl from-brand to-brand/75 text-3xl font-bold text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                  className={cn(
                    "absolute inset-0 flex items-center justify-center rounded-full",
                    "bg-black/0 text-white opacity-0 transition-all duration-200",
                    "hover:bg-black/45 hover:opacity-100 focus-visible:bg-black/45 focus-visible:opacity-100",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50",
                    busy && "pointer-events-none opacity-100 bg-black/40",
                  )}
                  aria-label="تغییر تصویر پروفایل"
                >
                  {busy ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <Camera className="h-6 w-6" />
                  )}
                </button>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => onPickImage(e.target.files?.[0])}
                />
              </div>

              <div className="min-w-0 pb-1 text-start">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                    {employee.fullName}
                  </h1>
                  <Badge
                    variant={employee.isActive ? "success" : "secondary"}
                    className="rounded-full"
                  >
                    {employee.isActive ? "فعال" : "غیرفعال"}
                  </Badge>
                </div>

                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 font-medium text-foreground/85">
                    <Briefcase className="h-3.5 w-3.5 shrink-0 text-brand" />
                    {roleLabel}
                  </span>
                  {teamKindLabel && (
                    <>
                      <span className="text-border">|</span>
                      <span className="inline-flex items-center gap-1.5">
                        <UserCog className="h-3.5 w-3.5 shrink-0 text-brand/70" />
                        تیم {teamKindLabel}
                      </span>
                    </>
                  )}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge
                    variant={ROLE_BADGE_VARIANTS[roleCode] || "secondary"}
                    className="rounded-full"
                  >
                    {roleLabel}
                  </Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                    className="h-7 rounded-full px-3 text-xs"
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    {employee.profileImage ? "تغییر تصویر" : "آپلود تصویر"}
                  </Button>
                  {employee.profileImage && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={onRemoveImage}
                      className="h-7 rounded-full px-3 text-xs text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      حذف تصویر
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 lg:pb-1">
              <Button
                variant="outline"
                size="sm"
                onClick={onBack}
                className="rounded-full border-border/70 bg-background"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                بازگشت
              </Button>
              {!isManagerRole && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onEdit}
                  className="rounded-full border-border/70 bg-background transition-all hover:border-brand/40 hover:bg-brand/[0.04]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  ویرایش
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleStatus}
                className="rounded-full border-border/70 bg-background transition-all hover:border-brand/40 hover:bg-brand/[0.04]"
              >
                {employee.isActive ? (
                  <UserX className="h-3.5 w-3.5" />
                ) : (
                  <UserCheck className="h-3.5 w-3.5" />
                )}
                {employee.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
              </Button>
              <Button
                variant="brand"
                size="sm"
                onClick={onResetPassword}
                className="rounded-full shadow-sm shadow-brand/20"
              >
                <KeyRound className="h-3.5 w-3.5" />
                بازنشانی رمز
              </Button>
            </div>
          </div>

          {uploading && (
            <div className="mt-4">
              <UploadProgress
                fileName={uploadName}
                progress={uploadPct}
                status="uploading"
              />
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-2.5 border-t border-border/40 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <MetaChip
              icon={Mail}
              label="ایمیل"
              value={employee.email}
              dir="ltr"
            />
            <MetaChip
              icon={Phone}
              label="تلفن"
              value={
                employee.phone ? formatPhoneDisplay(employee.phone) : "ثبت نشده"
              }
              dir="ltr"
            />
            <MetaChip
              icon={CalendarClock}
              label="آخرین ورود"
              value={
                employee.lastLoginAt
                  ? formatDateTime(employee.lastLoginAt)
                  : "هنوز وارد نشده"
              }
            />
            <MetaChip
              icon={CalendarPlus}
              label="تاریخ عضویت"
              value={formatDate(employee.createdAt)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function EmployeeProfileSkeleton() {
  return (
    <div dir="rtl" className="mx-auto w-full max-w-4xl">
      <Card className="overflow-hidden border-border/50">
        <Skeleton className="h-28 w-full rounded-none sm:h-32" />
        <CardContent className="relative px-4 pb-6 pt-0 sm:px-6 sm:pb-7">
          <div className="-mt-14 flex flex-col gap-4 sm:-mt-16 sm:flex-row sm:items-end">
            <Skeleton className="h-28 w-28 rounded-full sm:h-32 sm:w-32" />
            <div className="flex-1 space-y-2 pb-1">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-2.5 border-t border-border/40 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetaChip({
  icon: Icon,
  label,
  value,
  dir,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border/40 bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 text-start">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p
          dir={dir || "rtl"}
          className={cn(
            "truncate text-xs font-semibold",
            dir === "ltr" && "tabular-nums [unicode-bidi:isolate]",
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
