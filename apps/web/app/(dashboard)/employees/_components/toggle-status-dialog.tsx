"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserCheck, UserX } from "lucide-react";
import { apiPatch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Employee } from "./types";

interface ToggleStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
}

export function ToggleStatusDialog({
  open,
  onOpenChange,
  employee,
}: ToggleStatusDialogProps) {
  const queryClient = useQueryClient();
  const nextActive = employee ? !employee.isActive : false;

  const mutation = useMutation({
    mutationFn: () =>
      apiPatch(`/employees/${employee!.id}/status`, { isActive: nextActive }),
    onSuccess: () => {
      toast.success(
        nextActive ? "حساب کارمند فعال شد" : "حساب کارمند غیرفعال شد"
      );
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      if (employee) {
        queryClient.invalidateQueries({ queryKey: ["employee", employee.id] });
      }
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "تغییر وضعیت ناموفق بود"
      );
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div
            className={`mb-2 flex h-12 w-12 items-center justify-center rounded-full ${
              nextActive ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-amber-100 dark:bg-amber-900/30"
            }`}
          >
            {nextActive ? (
              <UserCheck className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
            ) : (
              <UserX className="h-6 w-6 text-amber-700 dark:text-amber-300" />
            )}
          </div>
          <DialogTitle>
            {nextActive ? "فعال‌سازی حساب" : "غیرفعال‌سازی حساب"}
          </DialogTitle>
          <DialogDescription>
            {nextActive
              ? `آیا می‌خواهید حساب «${employee?.fullName}» را فعال کنید؟`
              : `با غیرفعال‌سازی، «${employee?.fullName}» دیگر نمی‌تواند وارد سیستم شود و نشست‌های فعال لغو می‌گردند.`}
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
            variant={nextActive ? "brand" : "destructive"}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !employee}
          >
            {mutation.isPending
              ? "در حال اعمال..."
              : nextActive
                ? "فعال شود"
                : "غیرفعال شود"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
