"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  FolderPlus,
  Loader2,
  Megaphone,
  Search,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import { cn, toEnglishDigits } from "@/lib/utils";
import { invalidateFinanceQueries } from "@/lib/finance-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DurationInput } from "@/components/brief/duration-input";
import {
  AspectRatioSelector,
  type AspectRatioValue,
} from "@/components/brief/aspect-ratio-selector";

type CreateCustomerOption = {
  id: string;
  customerCode?: string | null;
  personName: string;
  companyName: string | null;
  jobTitle?: string | null;
  phone?: string | null;
  whatsappRaw?: string | null;
  email?: string | null;
  city?: string | null;
  address?: string | null;
};

type CreateOptionsResponse = {
  customers: CreateCustomerOption[];
  services: Array<{ id: string; name: string; revisionCount?: number }>;
  formats: Array<{ id: string; name: string; ratio: string }>;
};

type CreatedProject = {
  id: string;
  code: string;
  title: string;
};

const LANGUAGE_OPTIONS = [
  { value: "fa", label: "فارسی / دری" },
  { value: "ps", label: "پشتو" },
  { value: "en", label: "انگلیسی" },
];

const PLATFORMS: { id: string; label: string }[] = [
  { id: "Facebook", label: "فیسبوک" },
  { id: "Instagram", label: "اینستاگرام" },
  { id: "TikTok", label: "تیک‌تاک" },
  { id: "YouTube", label: "یوتیوب" },
  { id: "Other", label: "سایر" },
];

const NONE = "__none__";

type WizardStepId = "customer" | "content" | "video";

const WIZARD_STEPS: {
  id: WizardStepId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}[] = [
  {
    id: "customer",
    label: "انتخاب مشتری",
    shortLabel: "مشتری",
    icon: UserRound,
  },
  {
    id: "content",
    label: "محتوای تبلیغ",
    shortLabel: "محتوا",
    icon: Megaphone,
  },
  {
    id: "video",
    label: "مشخصات ویدیو",
    shortLabel: "ویدیو",
    icon: Clapperboard,
  },
];

function customerLabel(c: CreateCustomerOption) {
  return c.companyName
    ? `${c.personName} — ${c.companyName}`
    : c.personName;
}

function FieldLabel({
  children,
  htmlFor,
  required,
}: {
  children: ReactNode;
  htmlFor?: string;
  required?: boolean;
}) {
  return (
    <Label htmlFor={htmlFor} className="text-xs font-medium">
      {children}
      {required ? <span className="ms-0.5 text-destructive">*</span> : null}
    </Label>
  );
}

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (project: CreatedProject) => void;
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateProjectDialogProps) {
  const queryClient = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);

  const [stepIndex, setStepIndex] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);

  const [customerQuery, setCustomerQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CreateCustomerOption | null>(null);

  const [title, setTitle] = useState("");
  const [serviceId, setServiceId] = useState(NONE);
  const [agreedPrice, setAgreedPrice] = useState("");
  const [notes, setNotes] = useState("");

  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [featureInput, setFeatureInput] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState("");
  const [mainMessage, setMainMessage] = useState("");
  const [cta, setCta] = useState("");

  const [durationSec, setDurationSec] = useState(60);
  const [aspect, setAspect] = useState<AspectRatioValue>({ formatId: "" });
  const [language, setLanguage] = useState("fa");
  const [tone, setTone] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(toEnglishDigits(customerQuery).trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [customerQuery]);

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
    setStepError(null);
    setCustomerQuery("");
    setDebouncedQuery("");
    setPickerOpen(false);
    setSelectedCustomer(null);
    setTitle("");
    setServiceId(NONE);
    setAgreedPrice("");
    setNotes("");
    setProductName("");
    setProductDescription("");
    setFeatureInput("");
    setFeatures([]);
    setAudience("");
    setGoal("");
    setMainMessage("");
    setCta("");
    setDurationSec(60);
    setAspect({ formatId: "" });
    setLanguage("fa");
    setTone("");
    setPlatforms([]);
    const focusTimer = setTimeout(() => searchRef.current?.focus(), 80);
    return () => clearTimeout(focusTimer);
  }, [open]);

  const optionsQuery = useQuery({
    queryKey: ["projects", "create-options", debouncedQuery],
    queryFn: () => {
      const params = new URLSearchParams();
      if (debouncedQuery) params.set("q", debouncedQuery);
      const qs = params.toString();
      return apiGet<CreateOptionsResponse>(
        qs ? `/projects/create-options?${qs}` : "/projects/create-options",
      );
    },
    enabled: open,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const customers = optionsQuery.data?.customers || [];
  const services = optionsQuery.data?.services || [];
  const formats = optionsQuery.data?.formats || [];

  useEffect(() => {
    if (!open || aspect.formatId || !formats.length) return;
    const preferred =
      formats.find((f) => f.ratio === "16:9") || formats[0] || null;
    if (preferred) {
      setAspect({ formatId: preferred.id });
    }
  }, [open, formats, aspect.formatId]);

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiPost<CreatedProject>("/projects", payload),
    onSuccess: async (project) => {
      toast.success("پروژه با موفقیت ایجاد شد", {
        description: `${project.code} — ${project.title}`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["projects-home"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["crm-customers"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        invalidateFinanceQueries(queryClient),
      ]);
      onOpenChange(false);
      onCreated?.(project);
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "ایجاد پروژه ناموفق بود",
      );
    },
  });

  const pending = createMutation.isPending;
  const currentStep = WIZARD_STEPS[stepIndex];

  const selectCustomer = (customer: CreateCustomerOption) => {
    setSelectedCustomer(customer);
    setPickerOpen(false);
    setCustomerQuery(customerLabel(customer));
    setStepError(null);
    if (!title.trim()) {
      const companyOrPerson = customer.companyName || customer.personName;
      setTitle(
        productName.trim()
          ? `${companyOrPerson} — ${productName.trim()}`
          : `پروژه ${customer.personName}`,
      );
    }
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerQuery("");
    setPickerOpen(true);
    searchRef.current?.focus();
  };

  const validateStep = (index: number): string | null => {
    const step = WIZARD_STEPS[index];
    if (step.id === "customer") {
      if (!selectedCustomer) return "انتخاب مشتری الزامی است.";
      if (title.trim().length < 2) return "عنوان پروژه حداقل ۲ نویسه باشد.";
      const priceRaw = toEnglishDigits(agreedPrice).replace(/,/g, "").trim();
      if (!priceRaw) return "مبلغ توافق‌شده الزامی است.";
      const n = Number(priceRaw);
      if (!Number.isFinite(n) || n <= 0) return "مبلغ توافق‌شده نامعتبر است.";
      return null;
    }
    if (step.id === "video") {
      if (!durationSec || durationSec <= 0) {
        return "مدت ویدیو باید بیشتر از صفر باشد.";
      }
      if (
        aspect.customRatio &&
        !/^\d{1,3}:\d{1,3}$/.test(aspect.customRatio.trim())
      ) {
        return "نسبت تصویر سفارشی معتبر نیست.";
      }
      return null;
    }
    return null;
  };

  const goNext = () => {
    const error = validateStep(stepIndex);
    if (error) {
      setStepError(error);
      toast.error(error);
      return;
    }
    setStepError(null);
    setStepIndex((i) => Math.min(i + 1, WIZARD_STEPS.length - 1));
  };

  const goBack = () => {
    setStepError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const handleSubmit = () => {
    if (pending) return;
    for (let i = 0; i < WIZARD_STEPS.length; i += 1) {
      const error = validateStep(i);
      if (error) {
        setStepError(error);
        setStepIndex(i);
        toast.error(error);
        return;
      }
    }
    if (!selectedCustomer) return;

    const priceRaw = toEnglishDigits(agreedPrice).replace(/,/g, "").trim();
    const autoTitle =
      title.trim() ||
      `${selectedCustomer.companyName || selectedCustomer.personName} — ${
        productName.trim() || "پروژه"
      }`;

    createMutation.mutate({
      crmCustomerId: selectedCustomer.id,
      title: autoTitle,
      serviceId: serviceId === NONE ? null : serviceId,
      formatId: aspect.formatId || null,
      customAspectRatio: aspect.customRatio?.trim() || null,
      durationSec: durationSec || null,
      language,
      tone: tone.trim() || null,
      platforms,
      productName: productName.trim() || null,
      productDescription: productDescription.trim() || null,
      features,
      audience: audience.trim() || null,
      goal: goal.trim() || null,
      mainMessage: mainMessage.trim() || null,
      cta: cta.trim() || null,
      notes: notes.trim() || null,
      agreedPrice: priceRaw ? Number(priceRaw) : null,
    });
  };

  const showCustomerResults = pickerOpen && !selectedCustomer;

  const emptyHint = useMemo(() => {
    if (optionsQuery.isFetching) return "در حال جستجو...";
    if (debouncedQuery) return "مشتری‌ای با این عبارت یافت نشد.";
    return "برای یافتن مشتری، نام یا شماره را جستجو کنید.";
  }, [optionsQuery.isFetching, debouncedQuery]);

  const togglePlatform = (id: string) => {
    setPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="flex max-h-[94vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        <DialogHeader className="border-b border-border/50 px-5 py-4 text-start sm:px-6">
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <FolderPlus className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <DialogTitle>ایجاد پروژه جدید</DialogTitle>
          <DialogDescription>
            همان مسیر ایجاد پروژه در پورتال مشتری — انتخاب مشتری و تکمیل بریف.
          </DialogDescription>

          <nav
            aria-label="مراحل ایجاد پروژه"
            className="mt-4 flex items-center gap-1 overflow-x-auto pb-0.5"
          >
            {WIZARD_STEPS.map((step, index) => {
              const Icon = step.icon;
              const active = index === stepIndex;
              const done = index < stepIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (index < stepIndex) {
                      setStepError(null);
                      setStepIndex(index);
                    }
                  }}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-2.5 py-2 text-start transition-colors",
                    active && "border-brand/45 bg-brand/[0.07]",
                    done && !active && "border-border/50 bg-muted/30",
                    !active && !done && "border-transparent bg-muted/15",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                      active && "bg-brand text-brand-foreground",
                      done && !active && "bg-brand/15 text-brand",
                      !active && !done && "bg-muted text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-semibold sm:text-xs">
                      <span className="sm:hidden">{step.shortLabel}</span>
                      <span className="hidden sm:inline">{step.label}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 sm:px-6">
          {stepError ? (
            <p
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
            >
              {stepError}
            </p>
          ) : null}

          {currentStep.id === "customer" ? (
            <section className="space-y-4">
              <div className="relative space-y-1.5">
                <FieldLabel htmlFor="create-project-customer" required>
                  مشتری
                </FieldLabel>
                <div className="relative">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchRef}
                    id="create-project-customer"
                    disabled={pending}
                    value={customerQuery}
                    placeholder="جستجوی نام، شرکت یا شماره..."
                    className="h-11 rounded-xl pe-10 ps-9"
                    onChange={(e) => {
                      setCustomerQuery(e.target.value);
                      setSelectedCustomer(null);
                      setPickerOpen(true);
                      setStepError(null);
                    }}
                    onFocus={() => {
                      if (!selectedCustomer) setPickerOpen(true);
                    }}
                    autoComplete="off"
                  />
                  {(customerQuery || selectedCustomer) && !pending ? (
                    <button
                      type="button"
                      className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={clearCustomer}
                      aria-label="پاک کردن مشتری"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                {showCustomerResults ? (
                  <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border/60 bg-card shadow-lg">
                    {customers.length === 0 ? (
                      <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                        {emptyHint}
                      </p>
                    ) : (
                      customers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          className="flex w-full flex-col gap-0.5 border-b border-border/40 px-3 py-2.5 text-start last:border-b-0 hover:bg-muted/50"
                          onClick={() => selectCustomer(customer)}
                        >
                          <span className="text-sm font-semibold">
                            {customerLabel(customer)}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {[
                              customer.customerCode,
                              customer.phone || customer.whatsappRaw,
                              customer.city,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>

              {selectedCustomer ? (
                <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-sm">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1 text-sm">
                      <p className="font-semibold">
                        {customerLabel(selectedCustomer)}
                      </p>
                      <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                        {selectedCustomer.customerCode ? (
                          <p>کد: {selectedCustomer.customerCode}</p>
                        ) : null}
                        {(selectedCustomer.phone ||
                          selectedCustomer.whatsappRaw) && (
                          <p dir="ltr" className="text-end sm:text-start">
                            {selectedCustomer.phone ||
                              selectedCustomer.whatsappRaw}
                          </p>
                        )}
                        {selectedCustomer.jobTitle ? (
                          <p>سمت: {selectedCustomer.jobTitle}</p>
                        ) : null}
                        {selectedCustomer.city ? (
                          <p>شهر: {selectedCustomer.city}</p>
                        ) : null}
                        {selectedCustomer.email ? (
                          <p className="sm:col-span-2" dir="ltr">
                            {selectedCustomer.email}
                          </p>
                        ) : null}
                        {selectedCustomer.address ? (
                          <p className="sm:col-span-2">
                            آدرس: {selectedCustomer.address}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <FieldLabel htmlFor="create-project-title" required>
                  عنوان پروژه
                </FieldLabel>
                <Input
                  id="create-project-title"
                  disabled={pending}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setStepError(null);
                  }}
                  className="h-11 rounded-xl"
                  placeholder="مثال: کمپین تبلیغاتی بهار"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel>سرویس</FieldLabel>
                  <Select
                    value={serviceId}
                    onValueChange={setServiceId}
                    disabled={pending}
                  >
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="انتخاب سرویس" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>بدون سرویس</SelectItem>
                      {services.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="create-project-price" required>
                    مبلغ توافق‌شده (افغانی)
                  </FieldLabel>
                  <Input
                    id="create-project-price"
                    disabled={pending}
                    inputMode="decimal"
                    value={agreedPrice}
                    onChange={(e) => setAgreedPrice(e.target.value)}
                    className="h-11 rounded-xl"
                    placeholder="الزامی"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="create-project-notes">
                  یادداشت مدیر
                </FieldLabel>
                <Textarea
                  id="create-project-notes"
                  disabled={pending}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[4rem] resize-none rounded-xl"
                  rows={2}
                  placeholder="توضیحات داخلی (اختیاری)"
                />
              </div>
            </section>
          ) : null}

          {currentStep.id === "content" ? (
            <section className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="create-project-product">
                    نام محصول / خدمت
                  </FieldLabel>
                  <Input
                    id="create-project-product"
                    disabled={pending}
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="create-project-audience">
                    مخاطب هدف
                  </FieldLabel>
                  <Input
                    id="create-project-audience"
                    disabled={pending}
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="create-project-product-desc">
                  توضیح محصول
                </FieldLabel>
                <Textarea
                  id="create-project-product-desc"
                  disabled={pending}
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  className="min-h-[4.5rem] resize-none rounded-xl"
                  rows={3}
                  placeholder="چند جمله درباره ویژگی‌های اصلی، مزیت رقابتی یا ارزش پیشنهادی..."
                />
              </div>

              <div className="space-y-1.5">
                <FieldLabel>ویژگی‌ها و مزایا</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    disabled={pending}
                    value={featureInput}
                    onChange={(e) => setFeatureInput(e.target.value)}
                    className="h-11 rounded-xl"
                    placeholder="یک ویژگی بنویسید و Enter بزنید"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const next = featureInput.trim();
                        if (!next) return;
                        setFeatures((f) => [...f, next]);
                        setFeatureInput("");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 shrink-0 rounded-xl"
                    disabled={pending || !featureInput.trim()}
                    onClick={() => {
                      const next = featureInput.trim();
                      if (!next) return;
                      setFeatures((f) => [...f, next]);
                      setFeatureInput("");
                    }}
                  >
                    افزودن
                  </Button>
                </div>
                {features.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {features.map((feature, index) => (
                      <Badge
                        key={`${feature}-${index}`}
                        variant="secondary"
                        className="gap-1 rounded-lg px-2 py-1 text-[11px]"
                      >
                        {feature}
                        <button
                          type="button"
                          className="rounded-sm opacity-70 hover:opacity-100"
                          onClick={() =>
                            setFeatures((prev) =>
                              prev.filter((_, i) => i !== index),
                            )
                          }
                          aria-label="حذف ویژگی"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="create-project-goal">هدف کمپین</FieldLabel>
                  <Input
                    id="create-project-goal"
                    disabled={pending}
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    className="h-11 rounded-xl"
                    placeholder="آگاهی، فروش، لید..."
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="create-project-cta">
                    دعوت به اقدام (CTA)
                  </FieldLabel>
                  <Input
                    id="create-project-cta"
                    disabled={pending}
                    value={cta}
                    onChange={(e) => setCta(e.target.value)}
                    className="h-11 rounded-xl"
                    placeholder="تماس بگیرید، سفارش دهید..."
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="create-project-message">
                  پیام اصلی
                </FieldLabel>
                <Textarea
                  id="create-project-message"
                  disabled={pending}
                  value={mainMessage}
                  onChange={(e) => setMainMessage(e.target.value)}
                  className="min-h-[4.5rem] resize-none rounded-xl"
                  rows={2}
                />
              </div>
            </section>
          ) : null}

          {currentStep.id === "video" ? (
            <section className="space-y-5">
              <DurationInput
                valueSec={durationSec}
                onChange={(sec) => {
                  setDurationSec(sec);
                  setStepError(null);
                }}
              />

              <AspectRatioSelector
                formats={formats}
                value={aspect}
                onChange={(next) => {
                  setAspect(next);
                  setStepError(null);
                }}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel>زبان</FieldLabel>
                  <Select
                    value={language}
                    onValueChange={setLanguage}
                    disabled={pending}
                  >
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="create-project-tone">لحن / سبک</FieldLabel>
                  <Input
                    id="create-project-tone"
                    disabled={pending}
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="h-11 rounded-xl"
                    placeholder="رسمی، صمیمی، ..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel>پلتفرم‌های انتشار</FieldLabel>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PLATFORMS.map((platform) => {
                    const checked = platforms.includes(platform.id);
                    return (
                      <label
                        key={platform.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                          checked
                            ? "border-brand/45 bg-brand/[0.06]"
                            : "border-border/50 bg-card hover:bg-muted/30",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => togglePlatform(platform.id)}
                          disabled={pending}
                        />
                        <span className="font-medium">{platform.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <DialogFooter className="gap-2 border-t border-border/50 bg-muted/20 px-5 py-3.5 sm:px-6">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            انصراف
          </Button>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            {stepIndex > 0 ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={pending}
                onClick={goBack}
              >
                <ChevronRight className="h-4 w-4" />
                قبلی
              </Button>
            ) : null}
            {stepIndex < WIZARD_STEPS.length - 1 ? (
              <Button
                type="button"
                variant="brand"
                className="rounded-xl"
                disabled={pending}
                onClick={goNext}
              >
                بعدی
                <ChevronLeft className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="brand"
                className="rounded-xl shadow-md shadow-brand/20"
                disabled={pending}
                onClick={handleSubmit}
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FolderPlus className="h-4 w-4" />
                )}
                ایجاد پروژه
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
