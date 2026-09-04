"use client";

import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { crmSalesText } from "./copy";

interface RepeatCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending?: boolean;
  customerName?: string | null;
  onConfirm: () => void;
}

export function RepeatCustomerDialog({
  open,
  onOpenChange,
  pending = false,
  customerName,
  onConfirm,
}: RepeatCustomerDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-foreground">
            <FolderPlus className="h-5 w-5" />
          </div>
          <DialogTitle>{crmSalesText("repeatCustomerTitle")}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p className="text-foreground">
                {crmSalesText("repeatCustomerConfirm")}
              </p>
              {customerName ? (
                <p className="text-xs text-muted-foreground">
                  {customerName}
                </p>
              ) : null}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {crmSalesText("cancel")}
          </Button>
          <Button
            type="button"
            variant="brand"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? crmSalesText("repeatCustomerCreating") : crmSalesText("ok")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
