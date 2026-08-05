"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, ApiError } from "@/lib/api";
import { getMe } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { parseLeadSource } from "./constants";
import type { CrmCustomer, CrmFormOptions } from "./types";

const NONE = "__none__";

const formSchema = z.object({
  personName: z.string().min(2, "نام باید حداقل ۲ حرف باشد"),
  whatsapp: z.string().min(8, "شماره واتساپ معتبر وارد کنید"),
  companyName: z.string().optional(),
  jobTitle: z.string().optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  email: z.string().email("ایمیل معتبر وارد کنید").optional().or(z.literal("")),
  source: z.string().optional(),
  sourceOther: z.string().optional(),
  salesOwnerId: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the dialog works in edit mode. */
  customer?: CrmCustomer | null;
}

export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
}: CustomerFormDialogProps) {
  const isEdit = Boolean(customer);
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: formOptions } = useQuery({
    queryKey: ["crm-form-options"],
    queryFn: () => apiGet<CrmFormOptions>("/crm/form-options"),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const { data: me } = useQuery({
    queryKey: ["me", "internal"],
    queryFn: getMe,
    enabled: open && !isEdit,
    staleTime: 60 * 1000,
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      source: "",
      sourceOther: "",
      salesOwnerId: "",
    },
  });

  const selectedSource = watch("source");

  useEffect(() => {
    if (!open) return;

    if (customer) {
      const parsedSource = parseLeadSource(customer.source);
      reset({
        personName: customer.personName,
        whatsapp: customer.whatsappRaw,
        companyName: customer.companyName ?? "",
        jobTitle: customer.jobTitle ?? "",
        phone: customer.phone ?? "",
        city: customer.city ?? "",
        email: customer.email ?? "",
        notes: customer.notes ?? "",
        source: parsedSource.source,
        sourceOther: parsedSource.sourceOther,
        salesOwnerId: customer.salesOwnerId ?? customer.salesOwner?.id ?? "",
      });
      return;
    }

    reset({
      personName: "",
      whatsapp: "",
      companyName: "",
      jobTitle: "",
      phone: "",
      city: "",
      email: "",
      notes: "",
      source: "",
      sourceOther: "",
      salesOwnerId: me?.id ?? "",
    });
  }, [open, customer, me?.id, reset]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["crm-customers"] });
    if (customer?.id) {
      queryClient.invalidateQueries({ queryKey: ["crm-customer", customer.id] });
    }
  };

  const buildPayload = (values: FormValues) => {
    const { salesOwnerId, source, sourceOther, ...rest } = values;

    const base = {
      ...rest,
      email: rest.email || undefined,
      source: source || undefined,
      sourceOther: source === "OTHER" ? sourceOther : undefined,
    };

    if (isEdit) {
      return {
        ...base,
        salesOwnerId: salesOwnerId || null,
      };
    }

    return {
      ...base,
      salesOwnerId: salesOwnerId || undefined,
    };
  };

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = buildPayload(values);
      if (isEdit && customer) {
        const { whatsapp: _whatsapp, ...rest } = payload;
        return apiPatch(`/crm/customers/${customer.id}`, rest);
      }
      return apiPost("/crm/customers", payload);
    },
    onSuccess: () => {
      toast.success(
        isEdit ? "اطلاعات مشتری به‌روزرسانی شد" : "مشتری با موفقیت ایجاد شد"
      );
      invalidate();
      onOpenChange(false);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "DUPLICATE_WHATSAPP") {
        const details = err.details as { customerId?: string } | undefined;
        toast.error(err.message || "این شماره واتساپ قبلاً ثبت شده است", {
          action: details?.customerId
            ? {
                label: "مشاهده مشتری",
                onClick: () => router.push(`/crm/${details.customerId}`),
              }
            : undefined,
          duration: 8000,
        });
        return;
      }
      toast.error(
        err instanceof Error
          ? err.message
          : isEdit
            ? "به‌روزرسانی مشتری ناموفق بود"
            : "ایجاد مشتری ناموفق بود"
      );
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "ویرایش مشتری" : "مشتری جدید"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "اطلاعات مشتری را ویرایش کنید. شماره واتساپ قابل تغییر نیست."
              : "اطلاعات مشتری یا سرنخ جدید را وارد کنید."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="personName">
                نام شخص <span className="text-destructive">*</span>
              </Label>
              <Input id="personName" {...register("personName")} />
              {errors.personName && (
                <p className="text-sm text-destructive">
                  {errors.personName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">
                واتساپ <span className="text-destructive">*</span>
              </Label>
              <Input
                id="whatsapp"
                dir="ltr"
                placeholder="0700123456"
                disabled={isEdit}
                {...register("whatsapp")}
              />
              {errors.whatsapp && (
                <p className="text-sm text-destructive">
                  {errors.whatsapp.message}
                </p>
              )}
            </div>
          </div>
          {!isEdit && (
            <p className="text-xs text-muted-foreground">
              هر شماره واتساپ فقط یک‌بار ثبت می‌شود. اگر قبلاً ثبت شده باشد،
              مشتری تکراری ساخته نمی‌شود.
            </p>
          )}

          <div className="grid gap-4 rounded-lg border bg-muted/10 p-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <p className="text-sm font-medium">اطلاعات فروش</p>
              <p className="text-xs text-muted-foreground">
                منبع ورود و مسئول فروش برای پیگیری فروش
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">منبع ورود مشتری</Label>
              <Controller
                name="source"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                  >
                    <SelectTrigger id="source">
                      <SelectValue placeholder="انتخاب منبع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>انتخاب نشده</SelectItem>
                      {(formOptions?.leadSources ?? []).map((item) => (
                        <SelectItem key={item.code} value={item.code}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            {selectedSource === "OTHER" && (
              <div className="space-y-2">
                <Label htmlFor="sourceOther">توضیح منبع (سایر)</Label>
                <Input
                  id="sourceOther"
                  placeholder="مثال: نمایشگاه، همکار..."
                  {...register("sourceOther")}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="salesOwnerId">مسئول فروش</Label>
              <Controller
                name="salesOwnerId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                  >
                    <SelectTrigger id="salesOwnerId">
                      <SelectValue placeholder="انتخاب مسئول فروش" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>تعیین نشده</SelectItem>
                      {(formOptions?.salesReps ?? []).map((rep) => (
                        <SelectItem key={rep.id} value={rep.id}>
                          {rep.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyName">نام شرکت</Label>
              <Input id="companyName" {...register("companyName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle">سمت / وظیفه</Label>
              <Input id="jobTitle" {...register("jobTitle")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">تلفن</Label>
              <Input id="phone" dir="ltr" {...register("phone")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">شهر</Label>
              <Input id="city" {...register("city")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">ایمیل</Label>
            <Input id="email" type="email" dir="ltr" {...register("email")} />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">یادداشت</Label>
            <Textarea id="notes" rows={3} {...register("notes")} />
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
            <Button type="submit" variant="brand" disabled={mutation.isPending}>
              {mutation.isPending
                ? "در حال ذخیره..."
                : isEdit
                  ? "ذخیره تغییرات"
                  : "ایجاد مشتری"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
