"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Lock, Phone } from "lucide-react";
import { loginPortal } from "@/lib/auth";
import { toast } from "sonner";
import { useRef, useState } from "react";
import {
  AuthFormError,
  AuthInput,
  AuthPasswordField,
  AuthSubmitButton,
} from "@/components/auth/auth-field";

const schema = z.object({
  whatsapp: z
    .string()
    .min(1, "شماره واتساپ الزامی است")
    .min(8, "شماره واتساپ معتبر وارد کنید"),
  password: z.string().min(1, "رمز عبور الزامی است"),
});

type FormData = z.infer<typeof schema>;

export function PortalLoginForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  async function onSubmit(data: FormData) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setFormError(null);
    setLoading(true);
    try {
      await loginPortal(data);
      toast.success("ورود موفق");
      // Drop the stale unauthenticated "me" cache; otherwise the portal
      // layout reads the old null session and bounces back to the login page.
      queryClient.removeQueries({ queryKey: ["me"] });
      queryClient.removeQueries({ queryKey: ["notifications"] });
      router.push("/portal");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "اطلاعات ورود نادرست است";
      setFormError(message);
      toast.error(message);
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
      noValidate
      aria-busy={loading || undefined}
    >
      {formError ? <AuthFormError message={formError} /> : null}

      <AuthInput
        id="whatsapp"
        label="شماره واتساپ"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        dir="ltr"
        icon={Phone}
        required
        disabled={loading}
        error={errors.whatsapp?.message}
        placeholder="0700123456 یا +93700123456"
        hint="شماره موبایل افغانستان با ۰۷ یا کد کشور ۹۳"
        autoFocus
        {...register("whatsapp")}
      />

      <AuthPasswordField
        id="password"
        label="رمز عبور"
        autoComplete="current-password"
        dir="ltr"
        icon={Lock}
        required
        disabled={loading}
        error={errors.password?.message}
        {...register("password")}
      />

      <div className="space-y-3">
        <AuthSubmitButton loading={loading} loadingText="در حال ورود...">
          ورود به پورتال
        </AuthSubmitButton>

        <p className="text-center text-sm">
          <Link
            href="/portal/forgot-password"
            className="font-medium text-brand transition-colors hover:text-brand/80 hover:underline underline-offset-4"
          >
            فراموشی رمز عبور
          </Link>
        </p>
      </div>
    </form>
  );
}
