"use client";

import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Send } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import {
  CONTACT_SUBJECTS,
  CONTACT_SUCCESS_MESSAGE,
  contactFormSchema,
  type PublicContactInfo,
} from "@/lib/contact";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export function ContactForm({
  subjects,
}: {
  subjects?: PublicContactInfo["subjects"];
}) {
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
      subject: "CONSULTATION",
      message: "",
    },
  });

  const options = subjects?.length ? subjects : CONTACT_SUBJECTS;
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
        subject: values.subject,
        message: values.message.trim(),
      });
      setSuccess(true);
      reset();
      toast.success("پیام با موفقیت ارسال شد");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در ارسال پیام");
    } finally {
      submittingRef.current = false;
    }
  }

  if (success) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center rounded-3xl border border-brand/25 bg-card px-6 py-12 text-center shadow-sm dark:bg-card/80"
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
      className="rounded-3xl border border-border/70 bg-card/90 p-5 shadow-sm dark:bg-card/75 sm:p-7"
    >
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          ارسال درخواست
        </h2>
        <p className="mt-1 text-sm leading-7 text-muted-foreground">
          اطلاعات خود را وارد کنید تا کارشناسان ما با شما تماس بگیرند.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
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

        <div className="space-y-1.5">
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

        <div className="space-y-1.5">
          <Label htmlFor="contact-phone">شماره</Label>
          <Input
            id="contact-phone"
            type="tel"
            dir="ltr"
            autoComplete="tel"
            placeholder="07XX XXX XXXX"
            disabled={busy}
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={errors.phone ? "contact-phone-error" : undefined}
            aria-required
            className={cn(FIELD_CLASS, "text-start")}
            {...register("phone")}
          />
          <FieldError id="contact-phone-error" message={errors.phone?.message} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contact-company">شرکت</Label>
          <Input
            id="contact-company"
            autoComplete="organization"
            placeholder="نام شرکت (اختیاری)"
            disabled={busy}
            aria-invalid={errors.company ? true : undefined}
            aria-describedby={errors.company ? "contact-company-error" : undefined}
            className={FIELD_CLASS}
            {...register("company")}
          />
          <FieldError id="contact-company-error" message={errors.company?.message} />
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="contact-subject">موضوع درخواست</Label>
        <Controller
          name="subject"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value || undefined}
              onValueChange={field.onChange}
              disabled={busy}
            >
              <SelectTrigger
                id="contact-subject"
                aria-invalid={errors.subject ? true : undefined}
                aria-required
                className={cn(FIELD_CLASS, "h-12")}
              >
                <SelectValue placeholder="موضوع را انتخاب کنید" />
              </SelectTrigger>
              <SelectContent>
                {options.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError id="contact-subject-error" message={errors.subject?.message} />
      </div>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="contact-message">پیام</Label>
        <Textarea
          id="contact-message"
          rows={6}
          placeholder="درباره پروژه یا نیاز خود بنویسید…"
          disabled={busy}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
          aria-required
          className="min-h-[9rem] rounded-xl border-border/80 bg-background/90 text-[15px] shadow-sm focus-visible:border-brand/55 focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-0 dark:bg-background/70"
          {...register("message")}
        />
        <FieldError id="contact-message-error" message={errors.message?.message} />
      </div>

      <Button
        type="submit"
        variant="brand"
        size="lg"
        disabled={busy}
        isLoading={busy}
        loadingText="در حال ارسال..."
        className="mt-6 h-12 w-full rounded-xl text-base font-semibold shadow-md shadow-brand/20 sm:w-auto sm:min-w-[14rem]"
      >
        <Send className="h-4 w-4" aria-hidden />
        ارسال درخواست
      </Button>
    </form>
  );
}
