"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { loginInternal } from "@/lib/auth";
import { getHomePath } from "@/lib/rbac";
import { toast } from "sonner";
import { useState } from "react";

const schema = z.object({
  email: z.string().email("ایمیل معتبر وارد کنید"),
  password: z.string().min(1, "رمز عبور الزامی است"),
});

type FormData = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const result = await loginInternal(data);
      const home = getHomePath(result.user.role);
      toast.success(`ورود موفق — ${result.user.role}`);
      // Drop the stale unauthenticated "me" cache; otherwise the dashboard
      // layout reads the old null session and bounces back to /login.
      queryClient.removeQueries({ queryKey: ["me"] });
      router.push(home);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "اطلاعات ورود نادرست است"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">ایمیل</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          dir="ltr"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">رمز عبور</Label>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>
      <Button type="submit" className="w-full" variant="brand" disabled={loading}>
        {loading ? "در حال ورود..." : "ورود"}
      </Button>
    </form>
  );
}
