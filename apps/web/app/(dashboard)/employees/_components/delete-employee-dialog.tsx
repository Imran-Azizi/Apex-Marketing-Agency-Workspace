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
import type { Employee } from "./types";

interface DeleteEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
}

export function DeleteEmployeeDialog({
  open,
  onOpenChange,
  employee,
}: DeleteEmployeeDialogProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/employees/${id}`),
    onSuccess: () => {
      toast.success("کارمند حذف شد");
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "حذف کارمند ناموفق بود");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <DialogTitle>حذف کارمند</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                آیا از حذف «{employee?.fullName}» مطمئن هستید؟ این عمل باعث
                غیرفعال شدن حساب و خروج از همه نشست‌ها می‌شود.
              </p>
            </div>
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
            onClick={() => employee && mutation.mutate(employee.id)}
            disabled={mutation.isPending || !employee}
          >
            {mutation.isPending ? "در حال حذف..." : "بله، حذف شود"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
