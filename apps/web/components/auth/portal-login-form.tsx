"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { loginPortal } from "@/lib/auth";
import { toast } from "sonner";
import { useState } from "react";

const schema = z.object({
  whatsapp: z.string().min(8, "شماره واتساپ معتبر وارد کنید"),
  password: z.string().min(1, "رمز عبور الزامی است"),
});

type FormData = z.infer<typeof schema>;

export function PortalLoginForm() {
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
      await loginPortal(data);
      toast.success("ورود موفق");
      // Drop the stale unauthenticated "me" cache; otherwise the portal
      // layout reads the old null session and bounces back to the login page.
      queryClient.removeQueries({ queryKey: ["me"] });
      router.push("/portal");
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
        <Label htmlFor="whatsapp">شماره واتساپ</Label>
        <Input
          id="whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0700123456 یا +93700123456"
          dir="ltr"
          {...register("whatsapp")}
        />
        <p className="text-xs text-muted-foreground">
          شماره موبایل افغانستان با ۰۷ یا کد کشور ۹۳
        </p>
        {errors.whatsapp && (
          <p className="text-sm text-destructive">{errors.whatsapp.message}</p>
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
      <p className="text-center text-sm">
        <Link href="/portal/forgot-password" className="text-brand hover:underline">
          فراموشی رمز عبور
        </Link>
      </p>
    </form>
  );
}
