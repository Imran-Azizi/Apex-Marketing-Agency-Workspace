"use client";

import { Send } from "lucide-react";
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

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  pending?: boolean;
  onConfirm: () => void;
}

export function TransferDialog({
  open,
  onOpenChange,
  selectedCount,
  pending = false,
  onConfirm,
}: TransferDialogProps) {
  const countLabel = selectedCount.toLocaleString("fa-AF", {
    numberingSystem: "latn",
  });

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!pending) onOpenChange(next); }}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Send className="h-5 w-5" />
          </div>
          <DialogTitle>{crmSalesText("transferConfirmTitle")}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>{crmSalesText("transferConfirmBody")}</p>
              <p className="font-medium text-foreground">
                {crmSalesText("selectedCount", { count: countLabel })}
              </p>
              <ul className="list-disc space-y-1 ps-5 text-start">
                <li>{crmSalesText("transferConfirmHint1")}</li>
                <li>{crmSalesText("transferConfirmHint2")}</li>
                <li>{crmSalesText("transferConfirmHint3")}</li>
              </ul>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
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
            disabled={pending || selectedCount < 1}
          >
            {pending ? crmSalesText("transferring") : crmSalesText("confirmTransfer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
