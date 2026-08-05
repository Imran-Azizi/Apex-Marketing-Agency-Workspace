"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ImagePlus } from "lucide-react";
import { apiPost, apiPatch, ApiError } from "@/lib/api";
import { uploadFileWithProgress, filePreviewUrl } from "@/lib/upload";
import { UPLOAD_PURPOSE } from "@/lib/media-manager";
import { UploadProgress } from "@/components/loading/upload-progress";
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

const baseSchema = z.object({
  fullName: z.string().min(2, "نام باید حداقل ۲ حرف باشد"),
  email: z.string().email("ایمیل معتبر وارد کنید"),
  phone: z.string().optional(),
  role: z.enum(EMPLOYEE_CREATE_ROLES),
  isActive: z.boolean(),
  profileImage: z.string().optional().nullable(),
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

export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
}: EmployeeFormDialogProps) {
  const isEdit = Boolean(employee);
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadName, setUploadName] = useState("");

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
    },
  });

  const selectedRole = watch("role") as EmployeeCreateRole;
  const profileImage = watch("profileImage");

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
            password: "",
          }
        : {
            fullName: "",
            email: "",
            phone: "",
            role: "SALES",
            isActive: true,
            profileImage: null,
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
      if (isEdit && employee) {
        const { password: _pw, ...rest } = values;
        return apiPatch(`/employees/${employee.id}`, {
          ...rest,
          phone: rest.phone || null,
          profileImage: rest.profileImage || null,
        });
      }
      return apiPost("/employees", {
        ...values,
        phone: values.phone || null,
        profileImage: values.profileImage || null,
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

  const initials = (watch("fullName") || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "ویرایش کارمند" : "ایجاد کارمند جدید"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "اطلاعات کارمند را ویرایش کنید. دسترسی‌ها بر اساس نقش به‌صورت خودکار اعمال می‌شود."
              : "کارمند جدید با نقش فروش، ادیتور، نریتور یا مالی ایجاد کنید."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <div className="flex items-center gap-4 rounded-lg border bg-muted/20 p-4">
            <Avatar className="h-16 w-16">
              {profileImage ? (
                <AvatarImage
                  src={filePreviewUrl(profileImage) || undefined}
                  alt=""
                />
              ) : null}
              <AvatarFallback className="text-lg">
                {initials || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <Label>تصویر پروفایل (اختیاری)</Label>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={(e) => onPickImage(e.target.files?.[0])}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  isLoading={uploading}
                  loadingText="در حال آپلود..."
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus className="h-4 w-4" />
                  انتخاب تصویر
                </Button>
                {profileImage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={uploading}
                    onClick={() => setValue("profileImage", null)}
                  >
                    حذف تصویر
                  </Button>
                )}
              </div>
              {uploading ? (
                <UploadProgress
                  fileName={uploadName}
                  progress={uploadPct}
                  status="uploading"
                  className="mt-2"
                />
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">
                نام کامل <span className="text-destructive">*</span>
              </Label>
              <Input id="fullName" {...register("fullName")} />
              {errors.fullName && (
                <p className="text-sm text-destructive">
                  {errors.fullName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">
                ایمیل / نام کاربری <span className="text-destructive">*</span>
              </Label>
              <Input id="email" type="email" dir="ltr" {...register("email")} />
              {errors.email && (
                <p className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">شماره تماس</Label>
              <Input id="phone" dir="ltr" {...register("phone")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">
                نقش <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="role">
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
              {selectedRole && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">
                    نقش انتخاب‌شده:
                  </span>
                  <Badge
                    variant={
                      ROLE_BADGE_VARIANTS[selectedRole as StaffRole] ||
                      "secondary"
                    }
                  >
                    {ROLE_LABELS_FA[selectedRole]}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="password">
                رمز عبور <span className="text-destructive">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                dir="ltr"
                autoComplete="new-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="isActive">وضعیت</Label>
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ? "active" : "inactive"}
                  onValueChange={(v) => field.onChange(v === "active")}
                >
                  <SelectTrigger id="isActive">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">فعال</SelectItem>
                    <SelectItem value="inactive">غیرفعال</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              انصراف
            </Button>
            <Button
              type="submit"
              variant="brand"
              disabled={uploading}
              isLoading={mutation.isPending}
              loadingText="در حال ذخیره..."
            >
              {isEdit ? "ذخیره تغییرات" : "ایجاد کارمند"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
