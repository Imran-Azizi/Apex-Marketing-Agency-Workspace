"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { apiDelete } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CrmCustomer } from "./types";

interface DeleteCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: CrmCustomer | null;
}

export function DeleteCustomerDialog({
  open,
  onOpenChange,
  customer,
}: DeleteCustomerDialogProps) {
  const queryClient = useQueryClient();

  const deleteCustomer = useMutation({
    mutationFn: (id: string) => apiDelete(`/crm/customers/${id}`),
    onSuccess: () => {
      toast.success("مشتری و تمام داده‌های مرتبط حذف شد");
      queryClient.invalidateQueries({ queryKey: ["crm-customers"] });
      queryClient.invalidateQueries({ queryKey: ["crm-customer"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "حذف مشتری ناموفق بود");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <DialogTitle>حذف کامل مشتری</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                آیا از حذف «{customer?.personName}» مطمئن هستید؟ این عمل قابل
                بازگشت نیست و موارد زیر به‌طور کامل از سیستم پاک می‌شود:
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
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteCustomer.isPending}
          >
            انصراف
          </Button>
          <Button
            variant="destructive"
            onClick={() => customer && deleteCustomer.mutate(customer.id)}
            disabled={deleteCustomer.isPending || !customer}
          >
            {deleteCustomer.isPending ? "در حال حذف..." : "بله، حذف کامل شود"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
