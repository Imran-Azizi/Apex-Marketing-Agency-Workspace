"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  invalidateAfterProjectCompleted,
  patchProjectCompletedInCache,
} from "@/lib/project-completion-queries";

type CompleteResult = {
  id?: string;
  status: string;
  customerFacingStatus?: string;
  completedAt?: string | null;
  alreadyCompleted?: boolean;
};

type CompleteProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle?: string | null;
  projectCode?: string | null;
};

export function CompleteProjectDialog({
  open,
  onOpenChange,
  projectId,
  projectTitle,
  projectCode,
}: CompleteProjectDialogProps) {
  const queryClient = useQueryClient();

  const completeMut = useMutation({
    mutationFn: () =>
      apiPost<CompleteResult>(`/delivery/${projectId}/complete`, {}),
    onSuccess: async (res) => {
      patchProjectCompletedInCache(
        queryClient,
        projectId,
        res?.completedAt ?? null,
      );
      await invalidateAfterProjectCompleted(queryClient, projectId);
      toast.success(
        res?.alreadyCompleted
          ? "پروژه قبلاً تکمیل شده است"
          : "پروژه با موفقیت تکمیل شد و وضعیت در تمام پنل‌ها به‌روز شد",
      );
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "ثبت تکمیل پروژه ناموفق بود",
      );
    },
  });

  const busy = completeMut.isPending;
  const errorMessage =
    completeMut.isError && completeMut.error instanceof Error
      ? completeMut.error.message
      : completeMut.isError
        ? "ثبت تکمیل پروژه ناموفق بود"
        : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
        if (!next) completeMut.reset();
      }}
    >
      <DialogContent
        dir="rtl"
        className="sm:max-w-md"
        overlayClassName="bg-black/60 backdrop-blur-sm"
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <DialogHeader className="text-start">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
            <CheckCircle2 className="h-6 w-6" aria-hidden />
          </div>
          <DialogTitle>تکمیل پروژه</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm leading-7 text-muted-foreground">
              <p>
                آیا از تکمیل
                {projectTitle ? (
                  <>
                    {" "}
                    «<span className="font-medium text-foreground">{projectTitle}</span>»
                  </>
                ) : (
                  " این پروژه"
                )}{" "}
                مطمئن هستید؟ پس از تأیید، وضعیت پروژه به «تکمیل‌شده» تغییر خواهد
                کرد.
              </p>
              <p>
                این اقدام در کل سیستم اعمال می‌شود (پنل مدیر، تدوین، نریشن،
                پورتال مشتری، مالی و CRM). فقط زمانی تأیید کنید که پروژه واقعاً
                تکمیل شده باشد.
              </p>
              {projectCode ? (
                <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                  {projectCode}
                </p>
              ) : null}
            </div>
          </DialogDescription>
        </DialogHeader>

        {errorMessage ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm leading-6 text-destructive"
          >
            {errorMessage}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:flex-row-reverse sm:justify-start">
          <Button
            type="button"
            variant="brand"
            className="gap-2"
            disabled={busy}
            isLoading={busy}
            loadingText="در حال تکمیل…"
            onClick={() => completeMut.mutate()}
          >
            <CheckCircle2 className="h-4 w-4" />
            تکمیل پروژه
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            انصراف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
