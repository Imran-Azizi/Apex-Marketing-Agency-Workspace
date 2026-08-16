"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { KeyRound, Lock } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  AuthFormError,
  AuthInput,
  AuthPasswordField,
  AuthSubmitButton,
} from "@/components/auth/auth-field";

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

type OtpRequestOpts = { silent?: boolean };

export default function PortalRegisterPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const [devOtp, setDevOtp] = useState<string | undefined>();
  const [otpReady, setOtpReady] = useState(false);
  const otpBootstrapped = useRef(false);

  const { data: invite, isLoading, error } = useQuery({
    queryKey: ["portal-invite", token],
    queryFn: () => apiGet<PortalInviteInfo>(`/portal/invite/${token}`),
  });

  const requestOtp = useMutation({
    mutationFn: (_opts?: OtpRequestOpts) =>
      apiPost<OtpResponse>(`/portal/invite/${token}/request-otp`, {}),
    onSuccess: (data, vars) => {
      setDevOtp(data.otpDev);
      setOtpReady(true);
      if (!vars?.silent) {
        toast.success(data.message);
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "ارسال کد ناموفق بود");
    },
  });

  // Validate invite then issue OTP automatically — no intermediate landing step
  useEffect(() => {
    if (!invite || otpBootstrapped.current) return;
    otpBootstrapped.current = true;
    requestOtp.mutate({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once per invite token
  }, [invite]);

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
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  const awaitingInitialOtp = !!invite && !otpReady && !requestOtp.isError;
  const registerError =
    register.error instanceof Error
      ? register.error.message
      : register.isError
        ? "ثبت‌نام ناموفق بود"
        : null;

  if (isLoading || awaitingInitialOtp) {
    return (
      <AuthShell audience="portal-register">
        <div className="space-y-4" aria-busy="true" aria-label="در حال آماده‌سازی ثبت‌نام">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </AuthShell>
    );
  }

  if (error || !invite) {
    return (
      <AuthShell
        audience="portal-register"
        title="دعوت نامعتبر"
        description="این لینک دعوت معتبر نیست یا منقضی شده است."
        footer={
          <p className="text-center text-sm">
            <Link
              href="/portal/login"
              className="font-medium text-brand transition-colors hover:text-brand/80 hover:underline underline-offset-4"
            >
              بازگشت به ورود
            </Link>
          </p>
        }
      >
        <EmptyState
          title="لینک دعوت نامعتبر یا منقضی است"
          description="لطفاً با تیم فروش اپیکس تماس بگیرید."
          className="border-0 bg-transparent px-0 py-6"
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      audience="portal-register"
      description={
        invite.existingAccount
          ? "حساب شما موجود است — رمز عبور جدید را تنظیم کنید."
          : "دعوت شما تأیید شد — حساب پورتال را با یک رمز امن کامل کنید."
      }
      footer={
        <p className="text-center text-sm">
          <Link
            href="/portal/login"
            className="font-medium text-brand transition-colors hover:text-brand/80 hover:underline underline-offset-4"
          >
            حساب دارید؟ ورود به پورتال
          </Link>
        </p>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-3.5 text-sm">
          <p>
            <span className="text-muted-foreground">واتساپ: </span>
            <span dir="ltr">{invite.whatsappNumber}</span>
          </p>
          <p className="mt-1">
            <span className="text-muted-foreground">انقضا: </span>
            {formatDate(invite.expiresAt)}
          </p>
        </div>

        {!otpReady ? (
          <div className="space-y-4">
            <AuthFormError message="صدور کد یک‌بارمصرف ناموفق بود. دوباره تلاش کنید." />
            <AuthSubmitButton
              type="button"
              loading={requestOtp.isPending}
              loadingText="در حال ارسال..."
              onClick={() => requestOtp.mutate({})}
            >
              درخواست مجدد کد یک‌بارمصرف
            </AuthSubmitButton>
          </div>
        ) : (
          <>
            {devOtp ? (
              <p className="rounded-xl border border-amber-200/80 bg-amber-50 px-3.5 py-3 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
                کد آزمایشی: <span dir="ltr">{devOtp}</span>
              </p>
            ) : null}
            <form
              onSubmit={handleSubmit((data) => {
                if (register.isPending) return;
                register.mutate({
                  password: data.password,
                  otp: data.otp,
                });
              })}
              className="space-y-4"
              noValidate
              aria-busy={register.isPending || undefined}
            >
              {registerError ? <AuthFormError message={registerError} /> : null}
              <AuthInput
                id="otp"
                label="کد یک‌بارمصرف"
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                maxLength={6}
                placeholder="123456"
                icon={KeyRound}
                required
                disabled={register.isPending}
                error={errors.otp?.message}
                {...registerField("otp")}
              />
              <AuthPasswordField
                id="password"
                label="رمز عبور"
                autoComplete="new-password"
                icon={Lock}
                required
                disabled={register.isPending}
                error={errors.password?.message}
                hint="حداقل ۸ کاراکتر"
                {...registerField("password")}
              />
              <AuthPasswordField
                id="confirmPassword"
                label="تکرار رمز عبور"
                autoComplete="new-password"
                icon={Lock}
                required
                disabled={register.isPending}
                error={errors.confirmPassword?.message}
                {...registerField("confirmPassword")}
              />
              <AuthSubmitButton
                loading={register.isPending}
                loadingText="در حال ثبت‌نام..."
              >
                تکمیل ثبت‌نام
              </AuthSubmitButton>
            </form>
            <Button
              type="button"
              variant="ghost"
              className="w-full rounded-xl"
              onClick={() => requestOtp.mutate({})}
              disabled={requestOtp.isPending || register.isPending}
              isLoading={requestOtp.isPending}
              loadingText="در حال ارسال..."
            >
              ارسال مجدد کد یک‌بارمصرف
            </Button>
          </>
        )}
      </div>
    </AuthShell>
  );
}
