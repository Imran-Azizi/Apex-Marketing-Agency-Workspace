"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AfghanDateTimeField,
  toLocalDateTimeInputValue,
} from "@/components/shared/afghan-datetime-field";
import {
  PRIORITY_LABELS,
  TASK_PRIORITIES,
  type ManagementTask,
  type TaskPriority,
  type TaskUserBrief,
} from "./types";

const schema = z.object({
  title: z.string().trim().min(2, "عنوان باید حداقل ۲ حرف باشد").max(200),
  description: z.string().trim().max(10000).optional().nullable(),
  assigneeId: z.string().min(1, "کارمند مسئول را انتخاب کنید"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  deadline: z.string().min(1, "مهلت الزامی است"),
});

type FormValues = z.infer<typeof schema>;

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: ManagementTask | null;
}

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
}: TaskFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(task);

  const { data: assignees = [] } = useQuery({
    queryKey: ["tasks", "assignees"],
    queryFn: () => apiGet<TaskUserBrief[]>("/tasks/assignees"),
    enabled: open,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      assigneeId: "",
      priority: "MEDIUM",
      deadline: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (task) {
      form.reset({
        title: task.title,
        description: task.description || "",
        assigneeId: task.assigneeId,
        priority: task.priority,
        deadline: toLocalDateTimeInputValue(task.deadline),
      });
    } else {
      form.reset({
        title: "",
        description: "",
        assigneeId: "",
        priority: "MEDIUM",
        deadline: "",
      });
    }
  }, [open, task, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        title: values.title.trim(),
        description: values.description?.trim() || null,
        assigneeId: values.assigneeId,
        priority: values.priority as TaskPriority,
        deadline: values.deadline,
      };
      if (isEdit && task) {
        return apiPatch<ManagementTask>(`/tasks/${task.id}`, payload);
      }
      return apiPost<ManagementTask>("/tasks", payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? "وظیفه به‌روزرسانی شد" : "وظیفه ایجاد و تخصیص شد");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError
          ? err.message
          : "ذخیره وظیفه با خطا مواجه شد";
      toast.error(message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" dir="rtl">
        <DialogHeader className="space-y-1.5 text-start">
          <DialogTitle>{isEdit ? "ویرایش وظیفه" : "ایجاد وظیفه جدید"}</DialogTitle>
          <DialogDescription className="text-start">
            عنوان، مسئول، مهلت و اولویت را مشخص کنید.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4 text-start"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="space-y-2">
            <Label htmlFor="task-title">عنوان</Label>
            <Input
              id="task-title"
              className="text-start"
              {...form.register("title")}
              placeholder="مثلاً آپلود ویدیوهای ساخته‌شده در وبسایت"
            />
            {form.formState.errors.title && (
              <p className="text-start text-xs text-destructive">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-description">توضیحات</Label>
            <Textarea
              id="task-description"
              rows={4}
              dir="rtl"
              className="text-start"
              {...form.register("description")}
              placeholder="جزئیات کار، لینک‌ها یا نکات مهم…"
            />
          </div>

          <div className="space-y-2">
            <Label>کارمند مسئول</Label>
            <Controller
              control={form.control}
              name="assigneeId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب کارمند" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignees.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                        {user.roleName ? ` — ${user.roleName}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.assigneeId && (
              <p className="text-start text-xs text-destructive">
                {form.formState.errors.assigneeId.message}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 text-start">
              <Label>اولویت</Label>
              <Controller
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {PRIORITY_LABELS[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2 text-start">
              <Label>مهلت</Label>
              <Controller
                control={form.control}
                name="deadline"
                render={({ field }) => (
                  <AfghanDateTimeField
                    id="task-deadline"
                    aria-label="مهلت وظیفه"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              {form.formState.errors.deadline && (
                <p className="text-start text-xs text-destructive">
                  {form.formState.errors.deadline.message}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              انصراف
            </Button>
            <Button
              type="submit"
              variant="brand"
              isLoading={mutation.isPending}
              loadingText="در حال ذخیره…"
            >
              {isEdit ? "ذخیره تغییرات" : "ایجاد و تخصیص"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
