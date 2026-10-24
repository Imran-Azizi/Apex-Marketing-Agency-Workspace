"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPost, apiDelete, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ManagementTask } from "./types";

type NoteAction =
  | "decline"
  | "complete"
  | "report-issue"
  | "approve"
  | "reject-completion"
  | "cancel"
  | "delete";

const ACTION_META: Record<
  NoteAction,
  { title: string; description: string; requireNote?: boolean; success: string; destructive?: boolean }
> = {
  decline: {
    title: "رد وظیفه",
    description: "در صورت نیاز دلیل رد را بنویسید.",
    success: "وظیفه رد شد",
  },
  complete: {
    title: "ارسال برای تأیید مدیر",
    description: "کار شما انجام شده؛ مدیر باید تکمیل را تأیید کند.",
    success: "وظیفه برای تأیید مدیر ارسال شد",
  },
  "report-issue": {
    title: "گزارش مشکل / درخواست بازنگری",
    description: "مشکل یا نیاز به توضیح را بنویسید.",
    requireNote: true,
    success: "گزارش مشکل ثبت شد",
  },
  approve: {
    title: "تأیید و تکمیل نهایی",
    description: "با تأیید شما، وضعیت وظیفه به «تکمیل‌شده» تغییر می‌کند.",
    success: "وظیفه به‌صورت نهایی تکمیل شد",
  },
  "reject-completion": {
    title: "رد تکمیل و بازگشت به کار",
    description: "دلیل رد را بنویسید تا کارمند ادامه دهد.",
    requireNote: true,
    success: "تکمیل رد شد و وظیفه به کارمند بازگشت",
    destructive: true,
  },
  cancel: {
    title: "لغو وظیفه",
    description: "این وظیفه لغو می‌شود و دیگر قابل پیگیری نیست.",
    success: "وظیفه لغو شد",
    destructive: true,
  },
  delete: {
    title: "حذف وظیفه",
    description: "وظیفه به‌صورت نرم حذف می‌شود.",
    success: "وظیفه حذف شد",
    destructive: true,
  },
};

function endpointFor(action: NoteAction, taskId: string) {
  if (action === "delete") return null;
  return `/tasks/${taskId}/${action}`;
}

export function TaskNoteActionDialog({
  open,
  onOpenChange,
  task,
  action,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: ManagementTask | null;
  action: NoteAction | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const meta = action ? ACTION_META[action] : null;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!task || !action) throw new Error("missing");
      if (action === "delete") {
        return apiDelete(`/tasks/${task.id}`);
      }
      const path = endpointFor(action, task.id);
      if (!path) throw new Error("missing path");
      return apiPost(path, { note: note.trim() || null });
    },
    onSuccess: (data) => {
      if (meta) toast.success(meta.success);
      if (action === "delete") {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        router.push("/tasks");
      } else if (task && data) {
        queryClient.setQueryData(["tasks", "detail", task.id], data);
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      }
      window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }, 400);
      setNote("");
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof ApiError ? err.message : "عملیات ناموفق بود");
    },
  });

  if (!action || !meta || !task) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setNote("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader className="text-start">
          <DialogTitle>{meta.title}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="task-action-note">
            یادداشت{meta.requireNote ? " (الزامی)" : " (اختیاری)"}
          </Label>
          <Textarea
            id="task-action-note"
            rows={4}
            dir="rtl"
            className="text-start"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="توضیحات…"
          />
        </div>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button
            variant={meta.destructive ? "destructive" : "brand"}
            isLoading={mutation.isPending}
            disabled={meta.requireNote && note.trim().length < 2}
            onClick={() => mutation.mutate()}
          >
            تأیید
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useSimpleTaskAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      action,
    }: {
      taskId: string;
      action: "accept" | "start";
    }) => apiPost(`/tasks/${taskId}/${action}`, {}),
    onMutate: async ({ taskId, action }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", "detail", taskId] });
      const previous = queryClient.getQueryData(["tasks", "detail", taskId]);
      if (previous && typeof previous === "object") {
        const nextStatus = action === "accept" ? "ACCEPTED" : "IN_PROGRESS";
        queryClient.setQueryData(["tasks", "detail", taskId], {
          ...previous,
          status: nextStatus,
        });
      }
      return { previous, taskId };
    },
    onSuccess: (data, vars) => {
      toast.success(
        vars.action === "accept"
          ? "وظیفه پذیرفته شد"
          : "وضعیت به «در حال انجام» تغییر کرد",
      );
      if (data) {
        queryClient.setQueryData(["tasks", "detail", vars.taskId], data);
      }
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      // Notifications are queued server-side; refresh badge shortly without blocking UX.
      window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }, 400);
    },
    onError: (err: unknown, vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["tasks", "detail", context.taskId],
          context.previous,
        );
      }
      toast.error(err instanceof ApiError ? err.message : "عملیات ناموفق بود");
    },
  });
}
