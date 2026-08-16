"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Camera,
  FileText,
  Trash2,
  Upload,
} from "lucide-react";
import { apiPost, apiPatch, ApiError } from "@/lib/api";
import {
  uploadFileWithProgress,
  filePreviewUrl,
  formatFileSize,
} from "@/lib/upload";
import { UPLOAD_PURPOSE } from "@/lib/media-manager";
import { UploadProgress } from "@/components/loading/upload-progress";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EMPLOYEE_CREATE_ROLES,
  ROLE_BADGE_VARIANTS,
  ROLE_LABELS_FA,
  type Employee,
  type EmployeeCreateRole,
  type StaffRole,
} from "./types";

const CV_ACCEPT =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const CV_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const CV_EXT = /\.(pdf|doc|docx)$/i;
const MAX_CV_BYTES = 10 * 1024 * 1024;

const baseSchema = z.object({
  fullName: z.string().min(2, "نام باید حداقل ۲ حرف باشد"),
  email: z.string().email("ایمیل معتبر وارد کنید"),
  phone: z.string().optional(),
  role: z.enum(EMPLOYEE_CREATE_ROLES),
  isActive: z.boolean(),
  profileImage: z.string().optional().nullable(),
  cvStorageKey: z.string().optional().nullable(),
  cvFileName: z.string().optional().nullable(),
  cvMimeType: z.string().optional().nullable(),
  cvSizeBytes: z.number().optional().nullable(),
  cvUploadedAt: z.string().optional().nullable(),
  password: z.string().optional(),
});

const createSchema = baseSchema.extend({
  password: z.string().min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد"),
});

type FormValues = z.infer<typeof baseSchema>;

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee | null;
}

function isAllowedCv(file: File) {
  return CV_MIME.has(file.type) || CV_EXT.test(file.name);
}

function cvTypeLabel(mime?: string | null, fileName?: string | null) {
  const name = (fileName || "").toLowerCase();
  const type = (mime || "").toLowerCase();
  if (type.includes("pdf") || name.endsWith(".pdf")) return "PDF";
  if (
    type.includes("wordprocessingml") ||
    name.endsWith(".docx") ||
    type.includes("msword") ||
    name.endsWith(".doc")
  ) {
    return name.endsWith(".doc") && !name.endsWith(".docx") ? "DOC" : "DOCX";
  }
  return "فایل";
}

function FormSection({ children }: { children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </section>
  );
}

function FieldShell({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 text-start">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required ? <span className="ms-1 text-destructive">*</span> : null}
      </Label>
      {children}
      {hint && !error ? (
        <p className="text-[11px] leading-5 text-muted-foreground">{hint}</p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
}: EmployeeFormDialogProps) {
  const isEdit = Boolean(employee);
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const cvRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadName, setUploadName] = useState("");
  const [cvUploading, setCvUploading] = useState(false);
  const [cvUploadPct, setCvUploadPct] = useState(0);
  const [cvUploadName, setCvUploadName] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(isEdit ? baseSchema : createSchema),
    defaultValues: {
      role: "SALES",
      isActive: true,
      profileImage: null,
      cvStorageKey: null,
      cvFileName: null,
      cvMimeType: null,
      cvSizeBytes: null,
      cvUploadedAt: null,
    },
  });

  const selectedRole = watch("role") as EmployeeCreateRole;
  const profileImage = watch("profileImage");
  const cvStorageKey = watch("cvStorageKey");
  const cvFileName = watch("cvFileName");
  const cvMimeType = watch("cvMimeType");
  const cvSizeBytes = watch("cvSizeBytes");

  useEffect(() => {
    if (!open) return;
    reset(
      employee
        ? {
            fullName: employee.fullName,
            email: employee.email,
            phone: employee.phone ?? "",
            role: (EMPLOYEE_CREATE_ROLES.includes(
              employee.role.code as EmployeeCreateRole,
            )
              ? employee.role.code
              : "SALES") as EmployeeCreateRole,
            isActive: employee.isActive,
            profileImage: employee.profileImage,
            cvStorageKey: employee.cvStorageKey ?? null,
            cvFileName: employee.cvFileName ?? null,
            cvMimeType: employee.cvMimeType ?? null,
            cvSizeBytes: employee.cvSizeBytes ?? null,
            cvUploadedAt: employee.cvUploadedAt ?? null,
            password: "",
          }
        : {
            fullName: "",
            email: "",
            phone: "",
            role: "SALES",
            isActive: true,
            profileImage: null,
            cvStorageKey: null,
            cvFileName: null,
            cvMimeType: null,
            cvSizeBytes: null,
            cvUploadedAt: null,
            password: "",
          },
    );
  }, [open, employee, reset]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["employees"] });
    if (employee) {
      queryClient.invalidateQueries({ queryKey: ["employee", employee.id] });
    }
  };

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const cvPayload = {
        cvStorageKey: values.cvStorageKey || null,
        cvFileName: values.cvFileName || null,
        cvMimeType: values.cvMimeType || null,
        cvSizeBytes: values.cvSizeBytes ?? null,
        cvUploadedAt: values.cvUploadedAt || null,
      };
      if (isEdit && employee) {
        const { password: _pw, ...rest } = values;
        return apiPatch(`/employees/${employee.id}`, {
          ...rest,
          phone: rest.phone || null,
          profileImage: rest.profileImage || null,
          ...cvPayload,
        });
      }
      return apiPost("/employees", {
        ...values,
        phone: values.phone || null,
        profileImage: values.profileImage || null,
        ...cvPayload,
      });
    },
    onSuccess: () => {
      toast.success(
        isEdit ? "اطلاعات کارمند به‌روزرسانی شد" : "کارمند با موفقیت ایجاد شد",
      );
      invalidate();
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError
          ? err.message
          : isEdit
            ? "به‌روزرسانی کارمند ناموفق بود"
            : "ایجاد کارمند ناموفق بود",
      );
    },
  });

  const onPickImage = async (file: File | undefined) => {
    if (!file) return;
    const allowed = new Set([
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ]);
    if (!allowed.has(file.type)) {
      toast.error("فقط فایل‌های JPG، PNG یا WEBP مجاز هستند");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم تصویر نباید بیشتر از ۵ مگابایت باشد");
      return;
    }
    try {
      setUploading(true);
      setUploadPct(0);
      setUploadName(file.name);
      const uploaded = await uploadFileWithProgress(
        file,
        {
          purpose: UPLOAD_PURPOSE.EMPLOYEE_PROFILE,
          userId: employee?.id,
        },
        (percent) => setUploadPct(percent),
      );
      setValue("profileImage", uploaded.key, { shouldDirty: true });
      setUploadPct(100);
      toast.success("تصویر پروفایل آپلود شد");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "آپلود تصویر ناموفق بود",
      );
    } finally {
      setUploading(false);
      setUploadPct(0);
      setUploadName("");
    }
  };

  const clearCv = () => {
    setValue("cvStorageKey", null, { shouldDirty: true });
    setValue("cvFileName", null, { shouldDirty: true });
    setValue("cvMimeType", null, { shouldDirty: true });
    setValue("cvSizeBytes", null, { shouldDirty: true });
    setValue("cvUploadedAt", null, { shouldDirty: true });
    if (cvRef.current) cvRef.current.value = "";
  };

  const onPickCv = async (file: File | undefined) => {
    if (!file) return;
    if (!isAllowedCv(file)) {
      toast.error("فقط فایل‌های PDF، DOC یا DOCX مجاز هستند");
      return;
    }
    if (file.size > MAX_CV_BYTES) {
      toast.error("حجم رزومه نباید بیشتر از ۱۰ مگابایت باشد");
      return;
    }
    try {
      setCvUploading(true);
      setCvUploadPct(0);
      setCvUploadName(file.name);
      const uploaded = await uploadFileWithProgress(
        file,
        {
          purpose: UPLOAD_PURPOSE.EMPLOYEE_CV,
          userId: employee?.id,
        },
        (percent) => setCvUploadPct(percent),
      );
      setValue("cvStorageKey", uploaded.key, { shouldDirty: true });
      setValue("cvFileName", uploaded.name || file.name, { shouldDirty: true });
      setValue("cvMimeType", uploaded.mimeType || file.type || null, {
        shouldDirty: true,
      });
      setValue("cvSizeBytes", uploaded.sizeBytes || file.size, {
        shouldDirty: true,
      });
      setValue("cvUploadedAt", new Date().toISOString(), { shouldDirty: true });
      setCvUploadPct(100);
      toast.success("رزومه با موفقیت آپلود شد");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "آپلود رزومه ناموفق بود",
      );
    } finally {
      setCvUploading(false);
      setCvUploadPct(0);
      setCvUploadName("");
    }
  };

  const fullNameValue = watch("fullName");
  const initials = (fullNameValue || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");

  const anyUploading = uploading || cvUploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className={cn(
          "flex max-h-[min(92vh,880px)] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0",
          "sm:max-w-2xl md:max-w-3xl",
          "rounded-2xl border-border/70 shadow-xl",
        )}
      >
        <DialogHeader className="shrink-0 space-y-0 border-b border-border/60 bg-background px-5 py-4 text-start sm:px-6 sm:py-5">
          <DialogTitle className="text-lg font-semibold tracking-tight sm:text-xl">
            {isEdit ? "ویرایش کارمند" : "ایجاد کارمند جدید"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit
              ? "فرم ویرایش کارمند"
              : "فرم ایجاد کارمند جدید"}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 sm:space-y-5 sm:px-6 sm:py-5">
            <FormSection>
              <div className="grid gap-4 lg:grid-cols-[11.5rem_minmax(0,1fr)] lg:items-start">
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-muted/15 p-4 text-center">
                  <div className="relative">
                    <Avatar className="h-24 w-24 border-2 border-background shadow-md ring-1 ring-border/50">
                      {profileImage ? (
                        <AvatarImage
                          src={filePreviewUrl(profileImage) || undefined}
                          alt=""
                          className="object-cover"
                        />
                      ) : null}
                      <AvatarFallback className="bg-brand/10 text-xl font-semibold text-brand">
                        {initials || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileRef.current?.click()}
                      className={cn(
                        "absolute -bottom-1 -start-1 inline-flex h-8 w-8 items-center justify-center rounded-full",
                        "border border-border/70 bg-background text-foreground shadow-sm transition-colors",
                        "hover:border-brand/40 hover:bg-brand/5 hover:text-brand",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                        uploading && "pointer-events-none opacity-60",
                      )}
                      aria-label="آپلود تصویر پروفایل"
                    >
                      <Camera className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">تصویر پروفایل</p>
                    <p className="text-[11px] leading-5 text-muted-foreground">
                      JPG، PNG یا WEBP · حداکثر ۵ مگابایت
                    </p>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => onPickImage(e.target.files?.[0])}
                  />
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-full px-3 text-xs"
                      isLoading={uploading}
                      loadingText="آپلود..."
                      onClick={() => fileRef.current?.click()}
                    >
                      <Camera className="h-3.5 w-3.5" />
                      {profileImage ? "تغییر" : "انتخاب"}
                    </Button>
                    {profileImage ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-full px-3 text-xs text-muted-foreground hover:text-destructive"
                        disabled={uploading}
                        onClick={() =>
                          setValue("profileImage", null, { shouldDirty: true })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        حذف
                      </Button>
                    ) : null}
                  </div>
                  {uploading ? (
                    <UploadProgress
                      fileName={uploadName}
                      progress={uploadPct}
                      status="uploading"
                      className="w-full"
                    />
                  ) : null}
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300">
                      <FileText className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1 text-start">
                      <p className="text-sm font-medium">رزومه / CV</p>
                      <p className="mt-0.5 text-xs leading-6 text-muted-foreground">
                        PDF، DOC یا DOCX · حداکثر ۱۰ مگابایت
                      </p>
                    </div>
                    {cvStorageKey ? (
                      <Badge variant="success" className="rounded-full text-[10px]">
                        آماده
                      </Badge>
                    ) : null}
                  </div>

                  <input
                    ref={cvRef}
                    type="file"
                    accept={CV_ACCEPT}
                    className="hidden"
                    onChange={(e) => {
                      onPickCv(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />

                  {cvStorageKey ? (
                    <div className="rounded-2xl border border-border/70 bg-background p-3.5 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-foreground">
                            <FileText className="h-5 w-5" />
                          </span>
                          <div className="min-w-0 space-y-1">
                            <p
                              className="truncate text-sm font-semibold"
                              title={cvFileName || "رزومه"}
                            >
                              {cvFileName || "رزومه آپلودشده"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {cvTypeLabel(cvMimeType, cvFileName)}
                              {" · "}
                              {cvSizeBytes != null
                                ? formatFileSize(cvSizeBytes)
                                : "حجم نامشخص"}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-full px-3 text-xs"
                            disabled={cvUploading}
                            onClick={() => cvRef.current?.click()}
                          >
                            <Upload className="h-3.5 w-3.5" />
                            جایگزینی
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-full px-3 text-xs text-muted-foreground hover:text-destructive"
                            disabled={cvUploading}
                            onClick={clearCv}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            حذف
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={cvUploading}
                      onClick={() => cvRef.current?.click()}
                      className={cn(
                        "group flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/80",
                        "bg-muted/10 px-4 py-8 text-center transition-colors",
                        "hover:border-brand/40 hover:bg-brand/[0.03]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30",
                        cvUploading && "pointer-events-none opacity-70",
                      )}
                    >
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground transition-colors group-hover:border-brand/30 group-hover:text-brand">
                        <Upload className="h-4 w-4" />
                      </span>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">انتخاب فایل رزومه</p>
                        <p className="text-xs text-muted-foreground">
                          فایل را انتخاب کنید یا برای آپلود کلیک کنید
                        </p>
                      </div>
                    </button>
                  )}

                  {cvUploading ? (
                    <UploadProgress
                      fileName={cvUploadName}
                      progress={cvUploadPct}
                      status="uploading"
                    />
                  ) : null}
                </div>
              </div>
            </FormSection>

            <FormSection>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldShell
                  label="نام کامل"
                  htmlFor="fullName"
                  required
                  error={errors.fullName?.message}
                >
                  <Input
                    id="fullName"
                    placeholder="مثلاً احمد رضایی"
                    className="h-11 rounded-xl"
                    {...register("fullName")}
                  />
                </FieldShell>

                <FieldShell
                  label="ایمیل / نام کاربری"
                  htmlFor="email"
                  required
                  error={errors.email?.message}
                >
                  <Input
                    id="email"
                    type="email"
                    dir="ltr"
                    placeholder="name@example.com"
                    className="h-11 rounded-xl"
                    {...register("email")}
                  />
                </FieldShell>

                <FieldShell label="شماره تماس" htmlFor="phone">
                  <Input
                    id="phone"
                    dir="ltr"
                    placeholder="07XX XXX XXXX"
                    className="h-11 rounded-xl"
                    {...register("phone")}
                  />
                </FieldShell>

                <FieldShell label="نقش" htmlFor="role" required>
                  <Controller
                    name="role"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="role" className="h-11 rounded-xl">
                          <SelectValue placeholder="انتخاب نقش" />
                        </SelectTrigger>
                        <SelectContent>
                          {EMPLOYEE_CREATE_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {ROLE_LABELS_FA[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {selectedRole ? (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] text-muted-foreground">
                        نقش انتخاب‌شده:
                      </span>
                      <Badge
                        variant={
                          ROLE_BADGE_VARIANTS[selectedRole as StaffRole] ||
                          "secondary"
                        }
                        className="rounded-full"
                      >
                        {ROLE_LABELS_FA[selectedRole]}
                      </Badge>
                    </div>
                  ) : null}
                </FieldShell>

                {!isEdit ? (
                  <FieldShell
                    label="رمز عبور"
                    htmlFor="password"
                    required
                    error={errors.password?.message}
                    hint="حداقل ۸ کاراکتر"
                  >
                    <Input
                      id="password"
                      type="password"
                      dir="ltr"
                      autoComplete="new-password"
                      placeholder="********"
                      className="h-11 rounded-xl"
                      {...register("password")}
                    />
                  </FieldShell>
                ) : null}

                <FieldShell label="وضعیت حساب" htmlFor="isActive">
                  <Controller
                    name="isActive"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value ? "active" : "inactive"}
                        onValueChange={(v) => field.onChange(v === "active")}
                      >
                        <SelectTrigger id="isActive" className="h-11 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">فعال</SelectItem>
                          <SelectItem value="inactive">غیرفعال</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FieldShell>
              </div>
            </FormSection>
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border/60 bg-background/95 px-5 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:gap-3 sm:px-6">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl sm:min-w-[7.5rem]"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              انصراف
            </Button>
            <Button
              type="submit"
              variant="brand"
              className="h-11 rounded-xl sm:min-w-[10rem]"
              disabled={anyUploading}
              isLoading={mutation.isPending}
              loadingText={isEdit ? "در حال ذخیره..." : "در حال ایجاد..."}
            >
              {isEdit ? "ذخیره تغییرات" : "ایجاد کارمند"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
