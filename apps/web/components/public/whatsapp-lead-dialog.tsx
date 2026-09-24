"use client";

import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiPost, ApiError } from "@/lib/api";
import {
  openWhatsAppAfterLead,
  whatsappLeadFormSchema,
  type WhatsAppLeadFormValues,
  type WhatsAppLeadSubmitResult,
} from "@/lib/whatsapp-lead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WhatsAppPhoneInput } from "@/components/shared/whatsapp-phone-input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const FIELD_CLASS =
  "h-10 rounded-xl border-border/80 bg-background/90 text-sm shadow-sm shadow-black/[0.03] transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground/65 focus-visible:border-brand/55 focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-0 dark:bg-background/70 sm:h-11 sm:text-[15px]";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive sm:text-sm">
      {message}
    </p>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing public WhatsApp CTA — used if API omits / blocks a URL. */
  fallbackHref?: string | null;
};

export function WhatsAppLeadDialog({
  open,
  onOpenChange,
  fallbackHref,
}: Props) {
  const submittingRef = useRef(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WhatsAppLeadFormValues>({
    resolver: zodResolver(whatsappLeadFormSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      whatsapp: "",
      companyName: "",
      jobTitle: "",
    },
  });

  const busy = isSubmitting;

  function handleOpenChange(next: boolean) {
    if (busy && !next) return;
    if (!next) {
      setFormError(null);
      reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: WhatsAppLeadFormValues) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setFormError(null);

    try {
      const result = await apiPost<WhatsAppLeadSubmitResult>(
        "/public/whatsapp-lead",
        {
          name: values.name.trim(),
          whatsapp: values.whatsapp.trim(),
          companyName: values.companyName.trim(),
          jobTitle: values.jobTitle.trim(),
        },
      );

      const opened = openWhatsAppAfterLead(result.whatsappUrl, fallbackHref);
      if (!opened) {
        setFormError(
          "سرنخ ثبت شد، اما لینک واتساپ در دسترس نیست. لطفاً از صفحه تماس استفاده کنید.",
        );
        toast.success("سرنخ شما ثبت شد");
        return;
      }

      toast.success("سرنخ ثبت شد — در حال باز کردن واتساپ");
      handleOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "ثبت سرنخ ناموفق بود. لطفاً دوباره تلاش کنید.";
      setFormError(message);
      toast.error(message);
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        dir="rtl"
        aria-describedby={undefined}
        overlayClassName="bg-black/50 dark:bg-black/60"
        closeClassName="end-2 top-2 h-9 w-9 sm:end-3 sm:top-3 sm:h-8 sm:w-8"
        className={cn(
          "grid max-h-[min(92dvh,32rem)] w-[calc(100%-1rem)] max-w-[22rem]",
          "grid-rows-[auto,minmax(0,1fr)] gap-0 overflow-hidden",
          "rounded-2xl border-border/70 bg-card p-0 text-card-foreground shadow-2xl",
          "duration-150 sm:w-full sm:max-w-sm sm:max-h-[min(90dvh,34rem)]",
        )}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="shrink-0 space-y-0 border-b border-border/70 px-4 py-3 pe-11 text-start sm:px-5 sm:py-3.5 sm:pe-12">
          <DialogTitle className="text-base font-bold tracking-tight text-foreground sm:text-lg">
            شروع گفتگو در واتساپ
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          aria-busy={busy || undefined}
          className="flex min-h-0 flex-col"
        >
          <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain px-4 py-3 [-webkit-overflow-scrolling:touch] sm:space-y-3.5 sm:px-5 sm:py-4">
            <div className="space-y-1.5">
              <Label htmlFor="wa-lead-name" className="text-xs sm:text-sm">
                نام <span className="text-destructive">*</span>
              </Label>
              <Input
                id="wa-lead-name"
                autoComplete="name"
                disabled={busy}
                className={FIELD_CLASS}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "wa-lead-name-error" : undefined}
                {...register("name")}
              />
              <FieldError
                id="wa-lead-name-error"
                message={errors.name?.message}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wa-lead-whatsapp" className="text-xs sm:text-sm">
                شماره واتساپ <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="whatsapp"
                control={control}
                render={({ field }) => (
                  <WhatsAppPhoneInput
                    id="wa-lead-whatsapp"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    disabled={busy}
                    className="h-10 sm:h-11"
                    aria-invalid={!!errors.whatsapp}
                    aria-describedby={
                      errors.whatsapp ? "wa-lead-whatsapp-error" : undefined
                    }
                  />
                )}
              />
              <FieldError
                id="wa-lead-whatsapp-error"
                message={errors.whatsapp?.message}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="wa-lead-company" className="text-xs sm:text-sm">
                  نام شرکت <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="wa-lead-company"
                  autoComplete="organization"
                  disabled={busy}
                  className={FIELD_CLASS}
                  aria-invalid={!!errors.companyName}
                  aria-describedby={
                    errors.companyName ? "wa-lead-company-error" : undefined
                  }
                  {...register("companyName")}
                />
                <FieldError
                  id="wa-lead-company-error"
                  message={errors.companyName?.message}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wa-lead-job" className="text-xs sm:text-sm">
                  موقف <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="wa-lead-job"
                  autoComplete="organization-title"
                  disabled={busy}
                  className={FIELD_CLASS}
                  placeholder="مثلاً مدیر بازاریابی"
                  aria-invalid={!!errors.jobTitle}
                  aria-describedby={
                    errors.jobTitle ? "wa-lead-job-error" : undefined
                  }
                  {...register("jobTitle")}
                />
                <FieldError
                  id="wa-lead-job-error"
                  message={errors.jobTitle?.message}
                />
              </div>
            </div>

            {formError ? (
              <p
                role="alert"
                className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs leading-6 text-destructive sm:text-sm"
              >
                {formError}
              </p>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 flex-col gap-1.5 border-t border-border/70 bg-muted/20 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-col sm:space-x-0 sm:px-5 sm:py-3.5 sm:pb-3.5">
            <Button
              type="submit"
              disabled={busy}
              className={cn(
                "h-10 w-full rounded-xl bg-[#25D366] text-sm font-medium text-white hover:bg-[#1ebe57] sm:h-11",
                "focus-visible:ring-[#25D366]/50",
              )}
            >
              {busy ? (
                <>
                  <Loader2 className="ms-2 h-4 w-4 animate-spin" aria-hidden />
                  در حال ثبت…
                </>
              ) : (
                "ثبت و ادامه در واتساپ"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              className="h-9 w-full rounded-xl text-sm text-muted-foreground hover:text-foreground"
              onClick={() => handleOpenChange(false)}
            >
              انصراف
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
