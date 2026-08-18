"use client";

import { CustomerCard } from "@/components/public/customers/customer-card";
import type { ShowcaseCustomer } from "@/lib/customers";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function CustomerPreview({
  customer,
  open,
  onOpenChange,
}: {
  customer: ShowcaseCustomer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm overflow-hidden p-0 text-start sm:rounded-2xl"
        dir="rtl"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>مشاهده مشتری</DialogTitle>
          <DialogDescription>
            نمای تقریبی کارت مشتری در وب‌سایت عمومی
          </DialogDescription>
        </DialogHeader>
        {customer ? (
          <div className="bg-background p-3">
            <CustomerCard customer={customer} index={0} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
