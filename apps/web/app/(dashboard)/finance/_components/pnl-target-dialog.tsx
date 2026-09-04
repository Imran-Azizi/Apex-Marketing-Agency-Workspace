"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign, Megaphone, Target } from "lucide-react";
import { toast } from "sonner";
import { apiPut, ApiError } from "@/lib/api";
import { invalidateFinanceQueries } from "@/lib/finance-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney, type PnlMonth } from "./types";

const MONTH_LABELS = [
  "ژانویه",
  "فوریه",
  "مارس",
  "آوریل",
  "مه",
  "ژوئن",
  "جولای",
  "آگوست",
  "سپتامبر",
  "اکتبر",
  "نوامبر",
  "دسامبر",
];

interface PnlTargetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  month: number;
  target: PnlMonth["target"];
}

export function PnlTargetDialog({
  open,
  onOpenChange,
  year,
  month,
  target,
}: PnlTargetDialogProps) {
  const queryClient = useQueryClient();
  const [netProfitTarget, setNetProfitTarget] = useState("");
  const [advertisingBudget, setAdvertisingBudget] = useState("");

  useEffect(() => {
    if (!open) return;
    setNetProfitTarget(target ? String(target.netProfitTarget) : "");
    setAdvertisingBudget(target ? String(target.advertisingBudget) : "");
  }, [open, target]);

  const saveMutation = useMutation({
    mutationFn: (body: {
      year: number;
      month: number;
      netProfitTarget: number;
      advertisingBudget: number;
    }) => apiPut<PnlMonth>("/finance/pnl/targets", body),
    onSuccess: (res) => {
      toast.success("هدف ماه ذخیره شد");
      queryClient.setQueryData(["finance-pnl", year, month], res);
      queryClient.invalidateQueries({ queryKey: ["finance-pnl-months"] });
      void invalidateFinanceQueries(queryClient);
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "ذخیره هدف ناموفق بود");
    },
  });

  const monthLabel = MONTH_LABELS[month - 1] || String(month);

  function handleSave() {
    const np = Number(netProfitTarget.trim());
    const ad = Number(advertisingBudget.trim());
    if (!Number.isFinite(np)) {
      toast.error("هدف سود خالص معتبر نیست");
      return;
    }
    if (!Number.isFinite(ad) || ad < 0) {
      toast.error("بودجه تبلیغات معتبر نیست");
      return;
    }
    saveMutation.mutate({
      year,
      month,
      netProfitTarget: np,
      advertisingBudget: ad,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md" dir="rtl">
        <div className="border-b border-border/60 bg-muted/30 px-6 pb-4 pt-6">
          <DialogHeader className="space-y-2 text-start">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Target className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <DialogTitle className="text-base font-bold">تنظیم هدف ماه</DialogTitle>
                <DialogDescription className="text-xs leading-relaxed">
                  هدف سود خالص و بودجه تبلیغات برای{" "}
                  <span className="font-medium text-foreground">
                    {monthLabel} {year.toLocaleString("fa-AF", { numberingSystem: "latn" })}
                  </span>{" "}
                  را تعیین کنید. پس از ذخیره، محاسبه سود و زیان این ماه فعال می‌شود و
                  فقط تراکنش‌های همین ماه در شاخص‌ها لحاظ می‌گردند.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="pnl-net-target" className="flex items-center gap-1.5 text-xs">
              <CircleDollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              هدف سود خالص (افغانی)
            </Label>
            <Input
              id="pnl-net-target"
              type="number"
              inputMode="numeric"
              placeholder="مثلاً 500000"
              value={netProfitTarget}
              onChange={(e) => setNetProfitTarget(e.target.value)}
              className="tabular-nums"
            />
            <p className="text-[11px] text-muted-foreground">
              سود خالص = سود پروژه − مصارف شرکت
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pnl-ad-budget" className="flex items-center gap-1.5 text-xs">
              <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
              بودجه تبلیغات (افغانی)
            </Label>
            <Input
              id="pnl-ad-budget"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="مثلاً 50000"
              value={advertisingBudget}
              onChange={(e) => setAdvertisingBudget(e.target.value)}
              className="tabular-nums"
            />
            <p className="text-[11px] text-muted-foreground">
              بودجه تبلیغات ماهانه برای برنامه‌ریزی مالی ثبت می‌شود.
            </p>
          </div>

          {target ? (
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
              هدف فعلی: {formatMoney(target.netProfitTarget)} · بودجه فعلی:{" "}
              {formatMoney(target.advertisingBudget)}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
              برای این ماه هنوز هدفی ثبت نشده است.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-border/60 bg-muted/20 px-6 py-4 sm:justify-start">
          <Button
            type="button"
            disabled={saveMutation.isPending}
            onClick={handleSave}
          >
            {saveMutation.isPending ? "در حال ذخیره..." : "ذخیره هدف"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saveMutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            انصراف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
