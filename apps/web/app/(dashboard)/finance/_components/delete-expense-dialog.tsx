"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { apiDelete, ApiError } from "@/lib/api";
import { invalidateFinanceQueries } from "@/lib/finance-queries";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FinanceExpense } from "./types";

interface DeleteExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: FinanceExpense | null;
}

export function DeleteExpenseDialog({
  open,
  onOpenChange,
  expense,
}: DeleteExpenseDialogProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/finance/expenses/${id}`),
    onSuccess: () => {
      toast.success("مصرف حذف شد");
      queryClient.invalidateQueries({ queryKey: ["finance-expenses"] });
      void invalidateFinanceQueries(queryClient);
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "حذف ناموفق بود");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <DialogTitle>حذف مصرف شرکت</DialogTitle>
          <DialogDescription>
            آیا میخواهید این مصرف شرکت را حذف کنید؟
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            انصراف
          </Button>
          <Button
            variant="destructive"
            onClick={() => expense && mutation.mutate(expense.id)}
            disabled={mutation.isPending || !expense}
          >
            {mutation.isPending ? "در حال حذف..." : "بله، حذف شود"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
