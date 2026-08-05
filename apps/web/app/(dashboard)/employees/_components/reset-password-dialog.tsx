"use client";

import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { apiPost } from "@/lib/api";
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
import type { Employee } from "./types";

const schema = z
  .object({
    password: z.string().min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد"),
    confirm: z.string().min(8, "تأیید رمز عبور الزامی است"),
  })
  .refine((v) => v.password === v.confirm, {
    message: "رمز عبور و تأیید آن یکسان نیستند",
    path: ["confirm"],
  });

type FormValues = z.infer<typeof schema>;

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  employee,
}: ResetPasswordDialogProps) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (open) reset({ password: "", confirm: "" });
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      apiPost(`/employees/${employee!.id}/reset-password`, {
        password: values.password,
      }),
    onSuccess: () => {
      toast.success("رمز عبور بازنشانی شد و نشست‌های فعال لغو گردید");
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "بازنشانی رمز عبور ناموفق بود"
      );
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-brand-muted">
            <KeyRound className="h-6 w-6 text-brand" />
          </div>
          <DialogTitle>بازنشانی رمز عبور</DialogTitle>
          <DialogDescription>
            رمز عبور جدید برای «{employee?.fullName}» تنظیم کنید. کاربر پس از
            این عمل باید دوباره وارد شود.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="password">رمز عبور جدید</Label>
            <Input
              id="password"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">تأیید رمز عبور</Label>
            <Input
              id="confirm"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              {...register("confirm")}
            />
            {errors.confirm && (
              <p className="text-sm text-destructive">{errors.confirm.message}</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              انصراف
            </Button>
            <Button type="submit" variant="brand" disabled={mutation.isPending}>
              {mutation.isPending ? "در حال ذخیره..." : "بازنشانی رمز"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
