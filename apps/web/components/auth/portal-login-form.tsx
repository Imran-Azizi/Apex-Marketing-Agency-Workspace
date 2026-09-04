"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { loginPortal } from "@/lib/auth";
import { toast } from "sonner";
import { useRef, useState } from "react";
import {
  AuthFormError,
  AuthPasswordField,
  AuthSubmitButton,
} from "@/components/auth/auth-field";
import { AuthWhatsAppInput } from "@/components/auth/auth-whatsapp-input";
import { whatsappFieldSchema } from "@/lib/phone";

const schema = z.object({
  whatsapp: whatsappFieldSchema,
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
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { whatsapp: "", password: "" },
  });

  async function onSubmit(data: FormData) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setFormError(null);
    setLoading(true);
    try {
      await loginPortal(data);
      toast.success("ورود موفق");
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

      <Controller
        name="whatsapp"
        control={control}
        render={({ field }) => (
          <AuthWhatsAppInput
            id="whatsapp"
            label="شماره واتساپ"
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            required
            disabled={loading}
            error={errors.whatsapp?.message}
          />
        )}
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
        ورود به پورتال
      </AuthSubmitButton>
    </form>
  );
}
