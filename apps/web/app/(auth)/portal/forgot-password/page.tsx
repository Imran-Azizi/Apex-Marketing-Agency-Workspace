"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
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
import { toast } from "sonner";
import { AuthThemeChrome } from "@/components/layout/auth-theme-chrome";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [whatsapp, setWhatsapp] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState<string | undefined>();

  async function requestOtp() {
    setLoading(true);
    try {
      const res = await apiPost<{ message: string; otpDev?: string }>(
        "/auth/portal/forgot-password",
        { whatsapp }
      );
      setDevOtp(res.otpDev);
      toast.success(res.message);
      setStep(2);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setLoading(false);
    }
  }

  async function reset() {
    setLoading(true);
    try {
      await apiPost("/auth/portal/reset-password", { whatsapp, otp, password });
      toast.success("رمز عبور به‌روز شد");
      router.push("/portal/login");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthThemeChrome>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>بازیابی رمز عبور</CardTitle>
          <CardDescription>
            {step === 1
              ? "شماره واتساپ حساب خود را وارد کنید"
              : "کد یک‌بارمصرف و رمز جدید را وارد کنید"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 ? (
            <>
              <div className="space-y-2">
                <Label>شماره واتساپ</Label>
                <Input
                  dir="ltr"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="0700123456"
                />
              </div>
              <Button
                className="w-full"
                variant="brand"
                disabled={loading || whatsapp.length < 8}
                onClick={requestOtp}
              >
                دریافت کد
              </Button>
            </>
          ) : (
            <>
              {devOtp && (
                <p className="rounded-md bg-muted p-2 text-center text-sm" dir="ltr">
                  Dev OTP: {devOtp}
                </p>
              )}
              <div className="space-y-2">
                <Label>کد OTP</Label>
                <Input dir="ltr" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} />
              </div>
              <div className="space-y-2">
                <Label>رمز جدید</Label>
                <PasswordInput
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                variant="brand"
                disabled={loading || otp.length !== 6 || password.length < 8}
                onClick={reset}
              >
                ذخیره رمز جدید
              </Button>
            </>
          )}
          <p className="text-center text-sm">
            <Link href="/portal/login" className="text-brand hover:underline">
              بازگشت به ورود
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthThemeChrome>
  );
}
