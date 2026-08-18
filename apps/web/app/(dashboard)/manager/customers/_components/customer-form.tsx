"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiPatch, apiPost, ensureCsrf } from "@/lib/api";
import {
  CUSTOMER_DESCRIPTION_MAX,
  type ShowcaseCustomer,
} from "@/lib/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CustomerUploader } from "./customer-uploader";

type FormState = {
  name: string;
  companyName: string;
  description: string;
  sortOrder: string;
  isPublished: boolean;
  imageKey: string | null;
  imageUrl: string | null;
};

function emptyForm(): FormState {
  return {
    name: "",
    companyName: "",
    description: "",
    sortOrder: "",
    isPublished: true,
    imageKey: null,
    imageUrl: null,
  };
}

function fromCustomer(customer: ShowcaseCustomer): FormState {
  return {
    name: customer.name || "",
    companyName: customer.companyName || "",
    description: customer.description || "",
    sortOrder: String(customer.sortOrder ?? ""),
    isPublished: customer.isPublished ?? true,
    imageKey: customer.imageKey || null,
    imageUrl: customer.imageUrl || null,
  };
}

export function CustomerForm({
  open,
  onOpenChange,
  customer,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: ShowcaseCustomer | null;
  onSaved: () => void;
}) {
  const editing = !!customer;
  const [form, setForm] = useState<FormState>(emptyForm());

  useEffect(() => {
    if (!open) return;
    setForm(customer ? fromCustomer(customer) : emptyForm());
  }, [open, customer]);

  const saveMut = useMutation({
    mutationFn: async () => {
      await ensureCsrf();
      const name = form.name.trim();
      const companyName = form.companyName.trim();
      if (name.length < 2) throw new Error("نام مشتری الزامی است");
      if (companyName.length < 2) throw new Error("نام شرکت الزامی است");
      if (!form.imageKey) throw new Error("تصویر مشتری الزامی است");
      if (form.description.length > CUSTOMER_DESCRIPTION_MAX) {
        throw new Error(
          `توضیحات نباید بیشتر از ${CUSTOMER_DESCRIPTION_MAX} کاراکتر باشد`,
        );
      }
      const payload = {
        name,
        companyName,
        description: form.description.trim() || null,
        imageKey: form.imageKey,
        sortOrder: form.sortOrder.trim() ? Number(form.sortOrder) : undefined,
        isPublished: form.isPublished,
      };
      if (editing && customer) {
        return apiPatch<ShowcaseCustomer>(`/customers/${customer.id}`, payload);
      }
      return apiPost<ShowcaseCustomer>("/customers", payload);
    },
    onSuccess: () => {
      toast.success(editing ? "مشتری به‌روزرسانی شد" : "مشتری ایجاد شد");
      onOpenChange(false);
      onSaved();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "ذخیره مشتری ناموفق بود"),
  });

  const remaining = CUSTOMER_DESCRIPTION_MAX - form.description.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92vh] overflow-y-auto text-start sm:max-w-xl"
        dir="rtl"
      >
        <DialogHeader className="text-start sm:text-start">
          <DialogTitle>
            {editing ? "ویرایش مشتری" : "ایجاد مشتری"}
          </DialogTitle>
          <DialogDescription className="leading-6">
            تصویر و اطلاعات معرفی مشتری را وارد کنید. فقط مشتریان فعال در
            وب‌سایت عمومی نمایش داده می‌شوند.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>تصویر مشتری</Label>
            <CustomerUploader
              imageKey={form.imageKey}
              imageUrl={form.imageUrl}
              disabled={saveMut.isPending}
              onChange={({ imageKey, imageUrl }) =>
                setForm((p) => ({ ...p, imageKey, imageUrl }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-name">نام مشتری</Label>
            <Input
              id="customer-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="مثال: احمد کریمی"
              disabled={saveMut.isPending}
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-company">نام شرکت</Label>
            <Input
              id="customer-company"
              value={form.companyName}
              onChange={(e) =>
                setForm((p) => ({ ...p, companyName: e.target.value }))
              }
              placeholder="مثال: گروه صنعتی آریا"
              disabled={saveMut.isPending}
              maxLength={160}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="customer-desc">توضیحات کوتاه</Label>
              <span
                className={
                  remaining < 20
                    ? "text-[11px] tabular-nums text-destructive"
                    : "text-[11px] tabular-nums text-muted-foreground"
                }
              >
                {form.description.length}/{CUSTOMER_DESCRIPTION_MAX}
              </span>
            </div>
            <Textarea
              id="customer-desc"
              rows={4}
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  description: e.target.value.slice(0, CUSTOMER_DESCRIPTION_MAX),
                }))
              }
              placeholder="معرفی کوتاه و حرفه‌ای از همکاری یا جایگاه مشتری…"
              disabled={saveMut.isPending}
              maxLength={CUSTOMER_DESCRIPTION_MAX}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-order">ترتیب نمایش</Label>
            <Input
              id="customer-order"
              inputMode="numeric"
              value={form.sortOrder}
              onChange={(e) =>
                setForm((p) => ({ ...p, sortOrder: e.target.value }))
              }
              placeholder="خودکار"
              disabled={saveMut.isPending}
            />
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
            <Checkbox
              id="customer-published"
              checked={form.isPublished}
              onCheckedChange={(v) =>
                setForm((p) => ({ ...p, isPublished: v === true }))
              }
              disabled={saveMut.isPending}
            />
            <div className="space-y-1">
              <Label htmlFor="customer-published" className="text-sm font-medium">
                نمایش در وبسایت
              </Label>
              <p className="text-xs leading-5 text-muted-foreground">
                در صورت غیرفعال بودن، مشتری فقط در پنل مدیریت دیده می‌شود.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            variant="outline"
            disabled={saveMut.isPending}
            onClick={() => onOpenChange(false)}
          >
            انصراف
          </Button>
          <Button
            variant="brand"
            disabled={saveMut.isPending || !form.imageKey}
            onClick={() => saveMut.mutate()}
            className="gap-2"
          >
            {saveMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            ذخیره
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
