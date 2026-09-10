"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { apiPost, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface CrmBulkDeleteResult {
  selected: number;
  deleted: Array<{ id: string }>;
  failed: Array<{ id: string; message?: string }>;
}

interface BulkDeleteCustomersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ids: string[];
  onDeleted?: (deletedIds: string[]) => void;
}

function formatCount(n: number) {
  return n.toLocaleString("fa-AF", { numberingSystem: "latn" });
}

export function BulkDeleteCustomersDialog({
  open,
  onOpenChange,
  ids,
  onDeleted,
}: BulkDeleteCustomersDialogProps) {
  const queryClient = useQueryClient();
  const count = ids.length;
  const countLabel = formatCount(count);

  const bulkDelete = useMutation({
    mutationFn: (customerIds: string[]) =>
      apiPost<CrmBulkDeleteResult>("/crm/customers/bulk-delete", {
        ids: customerIds,
      }),
    onSuccess: async (result) => {
      const deletedCount = result.deleted.length;
      const failedCount = result.failed.length;
      if (failedCount && deletedCount) {
        toast.success(
          `${formatCount(deletedCount)} مورد با موفقیت حذف شد`,
        );
        toast.error(
          result.failed[0]?.message ||
            `${formatCount(failedCount)} مورد حذف نشد`,
        );
      } else {
        toast.success(
          deletedCount === 1
            ? "۱ مورد با موفقیت حذف شد"
            : `${formatCount(deletedCount)} مورد با موفقیت حذف شد`,
        );
      }

      onDeleted?.(result.deleted.map((item) => item.id));
      onOpenChange(false);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["crm-customers"] }),
        queryClient.invalidateQueries({ queryKey: ["crm-customer"] }),
        queryClient.invalidateQueries({ queryKey: ["crm-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
    },
    onError: (err) => {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "حذف انتخاب‌شده‌ها ناموفق بود";
      toast.error(message || "حذف انتخاب‌شده‌ها ناموفق بود");
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!bulkDelete.isPending) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <DialogTitle>حذف انتخاب‌شده‌ها</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                آیا از حذف دائمی{" "}
                <span className="font-medium text-foreground">
                  {countLabel} مورد
                </span>{" "}
                انتخاب‌شده مطمئن هستید؟ این عمل قابل بازگشت نیست و موارد زیر
                به‌طور کامل از سیستم پاک می‌شود:
              </p>
              <ul className="list-disc space-y-1 ps-5 text-start">
                <li>حساب پورتال مشتری، نشست‌ها و دعوت‌نامه‌ها</li>
                <li>فرصت‌های فروش، دارایی‌ها و اعلان‌ها</li>
                <li>پروژه‌ها، فاکتورها و پرداخت‌های مرتبط</li>
              </ul>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={bulkDelete.isPending}
          >
            انصراف
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              if (count < 1) {
                toast.error("لطفاً حداقل یک مورد را انتخاب کنید");
                return;
              }
              if (count > 100) {
                toast.error("حداکثر ۱۰۰ مورد در هر حذف گروهی مجاز است");
                return;
              }
              bulkDelete.mutate(ids);
            }}
            disabled={bulkDelete.isPending || count < 1}
          >
            {bulkDelete.isPending
              ? "در حال حذف..."
              : `بله، ${countLabel} مورد حذف شود`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
