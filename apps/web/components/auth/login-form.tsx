"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, Mail } from "lucide-react";
import { loginInternal } from "@/lib/auth";
import { getHomePath } from "@/lib/rbac";
import { toast } from "sonner";
import { useRef, useState } from "react";
import {
  AuthFormError,
  AuthInput,
  AuthPasswordField,
  AuthSubmitButton,
} from "@/components/auth/auth-field";

const schema = z.object({
  email: z
    .string()
    .min(1, "ایمیل الزامی است")
    .email("ایمیل معتبر وارد کنید"),
  password: z.string().min(1, "رمز عبور الزامی است"),
});

type FormData = z.infer<typeof schema>;

export function LoginForm() {
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
      const result = await loginInternal(data);
      const home = getHomePath(result.user.role);
      toast.success(`ورود موفق — ${result.user.role}`);
      // Drop the stale unauthenticated "me" cache; otherwise the dashboard
      // layout reads the old null session and bounces back to /login.
      queryClient.removeQueries({ queryKey: ["me"] });
      router.push(home);
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
        id="email"
        label="ایمیل"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        dir="ltr"
        icon={Mail}
        required
        disabled={loading}
        error={errors.email?.message}
        autoFocus
        {...register("email")}
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

      <AuthSubmitButton loading={loading} loadingText="در حال ورود...">
        ورود به فضای کاری
      </AuthSubmitButton>
    </form>
  );
}
