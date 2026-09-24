"use client";

import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Send } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import {
  CONTACT_SUCCESS_MESSAGE,
  contactFormSchema,
} from "@/lib/contact";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WhatsAppPhoneInput } from "@/components/shared/whatsapp-phone-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const FIELD_CLASS =
  "h-12 rounded-xl border-border/80 bg-background/90 text-[15px] shadow-sm shadow-black/[0.03] transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground/65 focus-visible:border-brand/55 focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-0 dark:bg-background/70";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

type FormValues = z.infer<typeof contactFormSchema>;

export function ContactForm() {
  const submittingRef = useRef(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(contactFormSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      company: "",
      message: "",
    },
  });

  const busy = isSubmitting;

  async function onSubmit(values: FormValues) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      await apiPost("/public/contact", {
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        company: values.company?.trim() || "",
        message: values.message.trim(),
      });
      setSuccess(true);
      reset();
      toast.success("پیام با موفقیت ارسال شد");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "خطا در ارسال پیام. لطفاً دوباره تلاش کنید.",
      );
    } finally {
      submittingRef.current = false;
    }
  }

  if (success) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-3xl border border-brand/25 bg-card px-6 py-12 text-center shadow-sm sm:px-8"
        role="status"
        aria-live="polite"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/15 text-brand">
          <CheckCircle2 className="h-7 w-7" aria-hidden />
        </span>
        <h2 className="mt-5 text-xl font-bold tracking-tight text-foreground">
          درخواست شما ثبت شد
        </h2>
        <p className="mt-3 max-w-md text-sm leading-8 text-muted-foreground">
          {CONTACT_SUCCESS_MESSAGE}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-8 h-11 rounded-xl"
          onClick={() => setSuccess(false)}
        >
          ارسال پیام جدید
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-busy={busy || undefined}
      className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm sm:p-7 lg:p-8"
    >
      <h3 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
        ارسال درخواست
      </h3>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-5">
        <div className="space-y-2">
          <Label htmlFor="contact-name">نام</Label>
          <Input
            id="contact-name"
            autoComplete="name"
            placeholder="نام و نام خانوادگی"
            disabled={busy}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
            aria-required
            className={FIELD_CLASS}
            {...register("name")}
          />
          <FieldError id="contact-name-error" message={errors.name?.message} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-email">ایمیل</Label>
          <Input
            id="contact-email"
            type="email"
            dir="ltr"
            autoComplete="email"
            placeholder="name@example.com"
            disabled={busy}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
            aria-required
            className={cn(FIELD_CLASS, "text-start")}
            {...register("email")}
          />
          <FieldError id="contact-email-error" message={errors.email?.message} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-phone">شماره</Label>
          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <WhatsAppPhoneInput
                id="contact-phone"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={busy}
                aria-invalid={!!errors.phone}
                aria-describedby={
                  errors.phone ? "contact-phone-error" : undefined
                }
                inputClassName={cn(FIELD_CLASS, "text-start h-12 rounded-xl")}
              />
            )}
          />
          <FieldError id="contact-phone-error" message={errors.phone?.message} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-company">شرکت</Label>
          <Input
            id="contact-company"
            autoComplete="organization"
            placeholder="نام شرکت (اختیاری)"
            disabled={busy}
            aria-invalid={errors.company ? true : undefined}
            aria-describedby={
              errors.company ? "contact-company-error" : undefined
            }
            className={FIELD_CLASS}
            {...register("company")}
          />
          <FieldError
            id="contact-company-error"
            message={errors.company?.message}
          />
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <Label htmlFor="contact-message">پیام</Label>
        <Textarea
          id="contact-message"
          rows={6}
          placeholder="درباره پروژه یا نیاز خود بنویسید…"
          disabled={busy}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={
            errors.message ? "contact-message-error" : undefined
          }
          aria-required
          className="min-h-[9rem] rounded-xl border-border/80 bg-background/90 text-[15px] shadow-sm focus-visible:border-brand/55 focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-0 dark:bg-background/70"
          {...register("message")}
        />
        <FieldError
          id="contact-message-error"
          message={errors.message?.message}
        />
      </div>

      <Button
        type="submit"
        variant="brand"
        size="lg"
        disabled={busy}
        isLoading={busy}
        loadingText="در حال ارسال..."
        className="public-lift mt-6 h-12 w-full rounded-xl text-base font-semibold shadow-md shadow-brand/20 sm:mt-7 sm:w-auto sm:min-w-[14rem]"
      >
        <Send className="h-4 w-4" aria-hidden />
        ارسال درخواست
      </Button>
    </form>
  );
}
