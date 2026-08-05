"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiGet, apiPost } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { AuthThemeChrome } from "@/components/layout/auth-theme-chrome";
import { ThemeToggle } from "@/components/layout/theme-toggle";

interface PortalInviteInfo {
  token: string;
  whatsappNumber: string;
  expiresAt: string;
  opportunityId: string;
  existingAccount: boolean;
}

interface OtpResponse {
  message: string;
  otpDev?: string;
  expiresInMinutes: number;
}

const registerSchema = z
  .object({
    password: z.string().min(8, "رمز عبور حداقل ۸ کاراکتر باشد"),
    confirmPassword: z.string().min(1, "تکرار رمز عبور الزامی است"),
    otp: z.string().length(6, "کد باید ۶ رقم باشد"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "رمز عبور و تکرار آن یکسان نیست",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function PortalRegisterPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState<string | undefined>();

  const { data: invite, isLoading, error } = useQuery({
    queryKey: ["portal-invite", token],
    queryFn: () => apiGet<PortalInviteInfo>(`/portal/invite/${token}`),
  });

  const requestOtp = useMutation({
    mutationFn: () =>
      apiPost<OtpResponse>(`/portal/invite/${token}/request-otp`, {}),
    onSuccess: (data) => {
      setOtpSent(true);
      setDevOtp(data.otpDev);
      toast.success(data.message);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "ارسال کد ناموفق بود");
    },
  });

  const register = useMutation({
    mutationFn: (body: { password: string; otp: string }) =>
      apiPost<{ accountId: string }>(`/portal/invite/${token}/register`, body),
    onSuccess: () => {
      toast.success("ثبت‌نام موفق — اکنون وارد شوید");
      router.push("/portal/login");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "ثبت‌نام ناموفق بود");
    },
  });

  const {
    register: registerField,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  if (isLoading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center p-4">
        <div className="absolute start-3 top-3 z-10 sm:start-4 sm:top-4">
          <ThemeToggle />
        </div>
        <Skeleton className="h-80 w-full max-w-md rounded-lg" />
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="relative flex min-h-screen items-center justify-center p-4">
        <div className="absolute start-3 top-3 z-10 sm:start-4 sm:top-4">
          <ThemeToggle />
        </div>
        <EmptyState
          title="لینک دعوت نامعتبر یا منقضی است"
          description="لطفاً با تیم فروش اپیکس تماس بگیرید."
        />
      </div>
    );
  }

  return (
    <AuthThemeChrome>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>ثبت‌نام پورتال مشتری</CardTitle>
          <CardDescription>
            {invite.existingAccount
              ? "حساب شما موجود است — رمز عبور جدید تنظیم کنید"
              : "ایجاد حساب پورتال اپیکس"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            <p>
              <span className="text-muted-foreground">واتساپ: </span>
              <span dir="ltr">{invite.whatsappNumber}</span>
            </p>
            <p className="mt-1">
              <span className="text-muted-foreground">انقضا: </span>
              {formatDate(invite.expiresAt)}
            </p>
          </div>

          {!otpSent ? (
            <Button
              className="w-full"
              variant="brand"
              onClick={() => requestOtp.mutate()}
              disabled={requestOtp.isPending}
            >
              {requestOtp.isPending ? "در حال ارسال..." : "درخواست کد یک‌بارمصرف"}
            </Button>
          ) : (
            <>
              {devOtp && (
                <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                  کد آزمایشی: <span dir="ltr">{devOtp}</span>
                </p>
              )}
              <form
                onSubmit={handleSubmit((data) =>
                  register.mutate({
                    password: data.password,
                    otp: data.otp,
                  })
                )}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="otp">کد یک‌بارمصرف</Label>
                  <Input
                    id="otp"
                    dir="ltr"
                    maxLength={6}
                    placeholder="123456"
                    {...registerField("otp")}
                  />
                  {errors.otp && (
                    <p className="text-sm text-destructive">
                      {errors.otp.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">رمز عبور</Label>
                  <PasswordInput
                    id="password"
                    autoComplete="new-password"
                    {...registerField("password")}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">
                      {errors.password.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">تکرار رمز عبور</Label>
                  <PasswordInput
                    id="confirmPassword"
                    autoComplete="new-password"
                    {...registerField("confirmPassword")}
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  variant="brand"
                  disabled={register.isPending}
                >
                  {register.isPending ? "در حال ثبت‌نام..." : "ثبت‌نام"}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </AuthThemeChrome>
  );
}
