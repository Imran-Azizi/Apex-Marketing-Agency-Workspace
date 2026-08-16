"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Lock, Phone } from "lucide-react";
import { apiPost } from "@/lib/api";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  AuthFormError,
  AuthInput,
  AuthPasswordField,
  AuthSubmitButton,
} from "@/components/auth/auth-field";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [whatsapp, setWhatsapp] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | undefined>();
  const submittingRef = useRef(false);

  async function requestOtp(event: React.FormEvent) {
    event.preventDefault();
    if (submittingRef.current) return;
    if (whatsapp.trim().length < 8) {
      setFieldError("شماره واتساپ معتبر وارد کنید");
      return;
    }
    submittingRef.current = true;
    setFieldError(null);
    setFormError(null);
    setLoading(true);
    try {
      const res = await apiPost<{ message: string; otpDev?: string }>(
        "/auth/portal/forgot-password",
        { whatsapp },
      );
      setDevOtp(res.otpDev);
      toast.success(res.message);
      setStep(2);
    } catch (e) {
      const message = e instanceof Error ? e.message : "خطا";
      setFormError(message);
      toast.error(message);
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  async function reset(event: React.FormEvent) {
    event.preventDefault();
    if (submittingRef.current) return;
    if (otp.length !== 6) {
      setFieldError("کد باید ۶ رقم باشد");
      return;
    }
    if (password.length < 8) {
      setFieldError("رمز عبور حداقل ۸ کاراکتر باشد");
      return;
    }
    submittingRef.current = true;
    setFieldError(null);
    setFormError(null);
    setLoading(true);
    try {
      await apiPost("/auth/portal/reset-password", { whatsapp, otp, password });
      toast.success("رمز عبور به‌روز شد");
      router.push("/portal/login");
    } catch (e) {
      const message = e instanceof Error ? e.message : "خطا";
      setFormError(message);
      toast.error(message);
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <AuthShell
      audience="portal-recover"
      title={step === 1 ? "بازیابی رمز عبور" : "تنظیم رمز جدید"}
      description={
        step === 1
          ? "شماره واتساپ حساب خود را وارد کنید تا کد بازیابی ارسال شود."
          : "کد یک‌بارمصرف ارسال‌شده و رمز عبور جدید را وارد کنید."
      }
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
      {step === 1 ? (
        <form onSubmit={requestOtp} className="space-y-4" noValidate>
          {formError ? <AuthFormError message={formError} /> : null}
          <AuthInput
            id="whatsapp"
            label="شماره واتساپ"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            icon={Phone}
            required
            disabled={loading}
            value={whatsapp}
            onChange={(e) => {
              setWhatsapp(e.target.value);
              setFieldError(null);
            }}
            placeholder="0700123456"
            error={fieldError ?? undefined}
          />
          <AuthSubmitButton loading={loading} loadingText="در حال ارسال...">
            دریافت کد
          </AuthSubmitButton>
        </form>
      ) : (
        <form onSubmit={reset} className="space-y-4" noValidate>
          {formError ? <AuthFormError message={formError} /> : null}
          {devOtp ? (
            <p
              className="rounded-xl border border-brand/20 bg-brand/10 px-3.5 py-3 text-center text-sm text-foreground"
              dir="ltr"
            >
              Dev OTP: {devOtp}
            </p>
          ) : null}
          <AuthInput
            id="otp"
            label="کد یک‌بارمصرف"
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            icon={KeyRound}
            required
            disabled={loading}
            value={otp}
            maxLength={6}
            onChange={(e) => {
              setOtp(e.target.value);
              setFieldError(null);
            }}
            error={fieldError && otp.length !== 6 ? fieldError : undefined}
          />
          <AuthPasswordField
            id="new-password"
            label="رمز جدید"
            autoComplete="new-password"
            icon={Lock}
            required
            disabled={loading}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldError(null);
            }}
            error={
              fieldError && password.length < 8 && otp.length === 6
                ? fieldError
                : undefined
            }
            hint="حداقل ۸ کاراکتر"
          />
          <AuthSubmitButton loading={loading} loadingText="در حال ذخیره...">
            ذخیره رمز جدید
          </AuthSubmitButton>
        </form>
      )}
    </AuthShell>
  );
}
