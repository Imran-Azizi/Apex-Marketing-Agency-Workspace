"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import Link from "next/link";
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  FolderOpen,
  Loader2,
  Megaphone,
  X,
  type LucideIcon,
} from "lucide-react";
import { DurationInput } from "@/components/brief/duration-input";
import { AspectRatioSelector } from "@/components/brief/aspect-ratio-selector";
import {
  ClientAssetsUploader,
  IDLE_ASSET_UPLOAD_STATE,
  type AssetUploadState,
  type ClientAssetItem,
} from "@/components/brief/client-assets-uploader";

interface PendingBrief {
  id: string;
  service: { id: string; name: string } | null;
}

interface Profile {
  personName: string;
  companyName: string | null;
  phone: string | null;
  normalizedWhatsapp: string;
  address: string | null;
  email: string | null;
  jobTitle: string | null;
}

const PLATFORMS: { id: string; label: string }[] = [
  { id: "Facebook", label: "فیسبوک" },
  { id: "Instagram", label: "اینستاگرام" },
  { id: "TikTok", label: "تیک‌تاک" },
  { id: "YouTube", label: "یوتیوب" },
  { id: "Other", label: "سایر" },
];

const LANGUAGE_OPTIONS = [
  { value: "fa", label: "فارسی / دری" },
  { value: "ps", label: "پشتو" },
  { value: "en", label: "انگلیسی" },
];

type WizardStepId = "contact" | "content" | "video" | "assets";

const WIZARD_STEPS: {
  id: WizardStepId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}[] = [
  { id: "contact", label: "اطلاعات تماس و شرکت", shortLabel: "تماس", icon: Building2 },
  { id: "content", label: "محتوای تبلیغ", shortLabel: "محتوا", icon: Megaphone },
  { id: "video", label: "مشخصات ویدیو", shortLabel: "ویدیو", icon: Clapperboard },
  { id: "assets", label: "فایل‌ها و دارایی‌های برند", shortLabel: "فایل‌ها", icon: FolderOpen },
];

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
    <Label
      htmlFor={htmlFor}
      className="inline-flex flex-wrap items-center gap-1.5 text-sm font-medium"
    >
      <span>{children}</span>
      {required && (
        <span className="text-xs font-normal text-destructive" aria-hidden>
          *
        </span>
      )}
    </Label>
  );
}

function Field({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-2", className)}>{children}</div>;
}

function StepIndicator({
  currentIndex,
  highestReached,
  onStepSelect,
}: {
  currentIndex: number;
  highestReached: number;
  onStepSelect: (index: number) => void;
}) {
  const progressPct =
    WIZARD_STEPS.length <= 1
      ? 0
      : (currentIndex / (WIZARD_STEPS.length - 1)) * 100;

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">پیشرفت فرم</p>
          <p className="mt-0.5 text-sm font-semibold">
            گام{" "}
            {(currentIndex + 1).toLocaleString("fa-AF", { numberingSystem: "latn" })} از{" "}
            {WIZARD_STEPS.length.toLocaleString("fa-AF", { numberingSystem: "latn" })}
          </p>
        </div>
        <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-brand">
          {Math.round(progressPct).toLocaleString("fa-AF", { numberingSystem: "latn" })}٪
        </span>
      </div>

      <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="absolute inset-y-0 start-0 rounded-full bg-brand transition-[width] duration-300 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <ol className="grid grid-cols-4 gap-2">
        {WIZARD_STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          const isReachable = index <= highestReached;
          const stepNumber = (index + 1).toLocaleString("fa-AF", {
            numberingSystem: "latn",
          });

          return (
            <li key={step.id} className="min-w-0">
              <button
                type="button"
                disabled={!isReachable}
                onClick={() => isReachable && onStepSelect(index)}
                className={cn(
                  "group flex w-full flex-col items-center gap-2 rounded-xl border px-1.5 py-2.5 text-center transition-all duration-200 sm:px-2 sm:py-3",
                  isActive &&
                    "border-brand/35 bg-brand/5 shadow-sm ring-1 ring-brand/20",
                  isCompleted &&
                    !isActive &&
                    "border-emerald-500/25 bg-emerald-500/5 hover:border-emerald-500/40",
                  !isActive &&
                    !isCompleted &&
                    isReachable &&
                    "border-border/80 bg-muted/20 hover:bg-muted/40",
                  !isReachable && "cursor-not-allowed border-transparent bg-muted/10 opacity-55",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border text-xs font-bold transition-all duration-200 sm:h-10 sm:w-10",
                    isActive && "border-brand bg-brand text-brand-foreground shadow-sm",
                    isCompleted &&
                      !isActive &&
                      "border-emerald-500/40 bg-emerald-500 text-white",
                    !isActive &&
                      !isCompleted &&
                      "border-muted-foreground/20 bg-background text-muted-foreground",
                  )}
                >
                  {isCompleted && !isActive ? (
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                  ) : (
                    <span className="flex flex-col items-center leading-none">
                      <Icon className="mb-0.5 hidden h-3.5 w-3.5 opacity-80 sm:block" />
                      <span>{stepNumber}</span>
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "line-clamp-2 text-[10px] font-medium leading-tight sm:text-[11px]",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span className="sm:hidden">{step.shortLabel}</span>
                  <span className="hidden sm:inline">{step.label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function PortalBriefForm() {
  const router = useRouter();
  const search = useSearchParams();
  const queryClient = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);
  const [highestReached, setHighestReached] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [opportunityId, setOpportunityId] = useState(search.get("opportunityId") || "");
  const [personName, setPersonName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [featureInput, setFeatureInput] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState("");
  const [mainMessage, setMainMessage] = useState("");
  const [cta, setCta] = useState("");
  const [durationSec, setDurationSec] = useState(30);
  const [formatId, setFormatId] = useState("");
  const [customAspectRatio, setCustomAspectRatio] = useState<string | undefined>();
  const [language, setLanguage] = useState("fa");
  const [tone, setTone] = useState("");
  const [narratorProfileId, setNarratorProfileId] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [assetUploadState, setAssetUploadState] = useState<AssetUploadState>(
    IDLE_ASSET_UPLOAD_STATE,
  );

  const onAssetUploadStateChange = useCallback((state: AssetUploadState) => {
    setAssetUploadState(state);
  }, []);

  const { data: pending, isLoading } = useQuery({
    queryKey: ["pending-briefs"],
    queryFn: () => apiGet<PendingBrief[]>("/portal/pending-briefs"),
  });

  const { data: profile } = useQuery({
    queryKey: ["portal-profile"],
    queryFn: () => apiGet<Profile>("/portal/profile"),
  });

  const { data: formats } = useQuery({
    queryKey: ["formats"],
    queryFn: () => apiGet<Array<{ id: string; name: string; ratio: string }>>("/public/formats"),
  });

  const {
    data: narrators = [],
    isLoading: narratorsLoading,
    isError: narratorsError,
  } = useQuery({
    queryKey: ["public-narrators"],
    queryFn: () =>
      apiGet<
        Array<{
          id: string;
          displayName: string;
          languages?: unknown;
          gender?: string | null;
          tone?: string | null;
        }>
      >("/public/narrators"),
  });

  const { data: assets, refetch: refetchAssets } = useQuery({
    queryKey: ["portal-assets"],
    queryFn: () => apiGet<ClientAssetItem[]>("/portal/assets"),
  });

  useEffect(() => {
    if (!opportunityId && pending?.length) setOpportunityId(pending[0].id);
  }, [pending, opportunityId]);

  useEffect(() => {
    if (!profile) return;
    setPersonName(profile.personName || "");
    setCompanyName(profile.companyName || "");
    setPhone(profile.phone || "");
    setAddress(profile.address || "");
    setEmail(profile.email || "");
    setJobTitle(profile.jobTitle || "");
  }, [profile]);

  const selectedOrder = useMemo(
    () => pending?.find((o) => o.id === opportunityId) || null,
    [pending, opportunityId],
  );

  useEffect(() => {
    if (!selectedOrder?.service?.name) return;
    setProductName((current) => current || selectedOrder.service!.name);
  }, [selectedOrder]);

  // Drop a stale selection if that narrator was removed/deactivated since load.
  useEffect(() => {
    if (!narratorProfileId) return;
    if (narratorsLoading) return;
    const stillValid = narrators.some((n) => n.id === narratorProfileId);
    if (!stillValid) setNarratorProfileId("");
  }, [narrators, narratorsLoading, narratorProfileId]);

  const currentStep = WIZARD_STEPS[stepIndex];
  const StepIcon = currentStep.icon;
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === WIZARD_STEPS.length - 1;

  const validateStep = (index: number): string | null => {
    const stepId = WIZARD_STEPS[index]?.id;
    if (stepId === "contact") {
      if (!opportunityId) return "لطفاً سفارش تأییدشده را مشخص کنید.";
      if (!personName.trim() || !jobTitle.trim() || !companyName.trim() || !address.trim()) {
        return "نام، سمت، شرکت و آدرس الزامی هستند.";
      }
      const trimmedPhone = phone.trim();
      if (!trimmedPhone || trimmedPhone.length < 5) {
        return "شماره تماس الزامی است (حداقل ۵ کاراکتر).";
      }
      const trimmedEmail = email.trim();
      if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        return "ایمیل معتبر نیست. یا خالی بگذارید یا مثل name@example.com وارد کنید.";
      }
      return null;
    }
    if (stepId === "video") {
      if (!durationSec || durationSec <= 0) {
        return "مدت ویدیو باید بیشتر از صفر باشد.";
      }
      if (customAspectRatio && !/^\d{1,3}:\d{1,3}$/.test(customAspectRatio)) {
        return "نسبت تصویر سفارشی معتبر نیست.";
      }
      return null;
    }
    return null;
  };

  const goToStep = (index: number) => {
    if (index < 0 || index >= WIZARD_STEPS.length) return;
    if (index > highestReached) return;
    setStepError(null);
    setStepIndex(index);
  };

  const goPrev = () => {
    if (isFirstStep) return;
    setStepError(null);
    setStepIndex((i) => i - 1);
  };

  const goNext = () => {
    const error = validateStep(stepIndex);
    if (error) {
      setStepError(error);
      toast.error(error);
      return;
    }
    if (currentStep.id === "assets" && !assetUploadState.canSubmit) {
      const msg = assetUploadState.isUploading
        ? "لطفاً تا پایان آپلود فایل‌ها صبر کنید."
        : "آپلود برخی فایل‌ها ناموفق بود. ابتدا خطا را برطرف کنید.";
      setStepError(msg);
      toast.error(msg);
      return;
    }
    setStepError(null);
    const next = Math.min(stepIndex + 1, WIZARD_STEPS.length - 1);
    setStepIndex(next);
    setHighestReached((h) => Math.max(h, next));
  };

  const submitMut = useMutation({
    mutationFn: () => {
      if (!assetUploadState.canSubmit) {
        throw new Error(
          assetUploadState.isUploading
            ? "هنوز آپلود فایل‌ها تمام نشده است."
            : "آپلود برخی فایل‌ها ناموفق بود.",
        );
      }
      const trimmedEmail = email.trim();
      if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        throw new Error("ایمیل معتبر نیست. یا خالی بگذارید یا مثل name@example.com وارد کنید.");
      }
      const trimmedPhone = phone.trim();
      if (!trimmedPhone || trimmedPhone.length < 5) {
        throw new Error("شماره تماس الزامی است (حداقل ۵ کاراکتر).");
      }
      if (!personName.trim() || !jobTitle.trim() || !companyName.trim() || !address.trim()) {
        throw new Error("نام، سمت، شرکت و آدرس الزامی هستند.");
      }
      if (!opportunityId) {
        throw new Error("لطفاً سفارش تأییدشده را مشخص کنید.");
      }
      if (!durationSec || durationSec <= 0) {
        throw new Error("مدت ویدیو باید بیشتر از صفر باشد.");
      }
      if (customAspectRatio && !/^\d{1,3}:\d{1,3}$/.test(customAspectRatio)) {
        throw new Error("نسبت تصویر سفارشی معتبر نیست.");
      }

      return apiPost<{ id: string }>("/portal/brief", {
        opportunityId,
        personName: personName.trim(),
        jobTitle: jobTitle.trim(),
        companyName: companyName.trim(),
        phone: trimmedPhone,
        address: address.trim(),
        email: trimmedEmail || undefined,
        website: website.trim() || undefined,
        productName: productName.trim() || undefined,
        productDescription: productDescription.trim() || undefined,
        features,
        audience: audience.trim() || undefined,
        goal: goal.trim() || undefined,
        mainMessage: mainMessage.trim() || undefined,
        cta: cta.trim() || undefined,
        durationSec: Number(durationSec),
        formatId: formatId || undefined,
        customAspectRatio: customAspectRatio || undefined,
        language: language.trim() || undefined,
        tone: tone.trim() || undefined,
        narratorProfileId: narratorProfileId || undefined,
        platforms,
        clientAssetIds: selectedAssets,
        title: `${companyName.trim() || personName.trim()} — ${productName.trim() || "پروژه"}`,
      });
    },
    onSuccess: (project) => {
      toast.success("پروژه با موفقیت ایجاد شد");
      void queryClient.invalidateQueries({ queryKey: ["portal-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["portal-projects"] });
      void queryClient.invalidateQueries({ queryKey: ["pending-briefs"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      router.push(`/portal/projects/${project.id}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطا در ارسال فرم"),
  });

  const handleSubmit = () => {
    if (!assetUploadState.canSubmit) {
      const msg = assetUploadState.isUploading
        ? "هنوز آپلود فایل‌ها تمام نشده است. لطفاً صبر کنید."
        : "آپلود برخی فایل‌ها ناموفق بود. تا رفع خطا امکان ساخت پروژه وجود ندارد.";
      toast.error(msg);
      setStepIndex(WIZARD_STEPS.findIndex((s) => s.id === "assets"));
      setStepError(msg);
      return;
    }
    for (let i = 0; i < WIZARD_STEPS.length; i += 1) {
      const error = validateStep(i);
      if (error) {
        setStepError(error);
        setStepIndex(i);
        toast.error(error);
        return;
      }
    }
    setStepError(null);
    submitMut.mutate();
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  if (!pending?.length) {
    return (
      <EmptyState
        title="سفارش تأییدشده‌ای برای فرم وجود ندارد"
        description="پس از تأیید سفارش و بیعانه توسط تیم فروش، می‌توانید فرم اطلاعات پروژه را تکمیل کنید."
        action={
          <Button asChild variant="outline">
            <Link href="/portal">بازگشت به داشبورد</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div dir="rtl" className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">فرم اطلاعات پروژه</h1>
        <p className="text-sm text-muted-foreground">
          اطلاعات را مرحله‌به‌مرحله تکمیل کنید. فیلدهای دارای{" "}
          <span className="text-destructive">*</span> الزامی هستند.
        </p>
      </div>

      <StepIndicator
        currentIndex={stepIndex}
        highestReached={highestReached}
        onStepSelect={goToStep}
      />

      <div key={currentStep.id} className="animate-fade-slide space-y-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand/20 bg-brand/10 text-brand">
              <StepIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                گام{" "}
                {(stepIndex + 1).toLocaleString("fa-AF", { numberingSystem: "latn" })}
              </p>
              <h2 className="text-lg font-semibold tracking-tight">{currentStep.label}</h2>
            </div>
          </div>

          {stepError && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              {stepError}
            </div>
          )}

          {currentStep.id === "contact" && (
            <Card className="overflow-hidden border shadow-sm">
              <CardContent className="grid gap-5 p-4 sm:grid-cols-2 sm:p-6">
                <Field>
                  <FieldLabel htmlFor="personName" required>
                    نام سفارش‌دهنده
                  </FieldLabel>
                  <Input
                    id="personName"
                    placeholder="مثلاً احمد کریمی"
                    value={personName}
                    onChange={(e) => {
                      setPersonName(e.target.value);
                      setStepError(null);
                    }}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="jobTitle" required>
                    سمت شغلی
                  </FieldLabel>
                  <Input
                    id="jobTitle"
                    placeholder="مثلاً مدیر بازاریابی"
                    value={jobTitle}
                    onChange={(e) => {
                      setJobTitle(e.target.value);
                      setStepError(null);
                    }}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="companyName" required>
                    نام شرکت / برند
                  </FieldLabel>
                  <Input
                    id="companyName"
                    placeholder="نام شرکت یا برند"
                    value={companyName}
                    onChange={(e) => {
                      setCompanyName(e.target.value);
                      setStepError(null);
                    }}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="phone" required>
                    شماره تماس
                  </FieldLabel>
                  <Input
                    id="phone"
                    dir="ltr"
                    type="tel"
                    placeholder="0700123456"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setStepError(null);
                    }}
                  />
                </Field>
                <Field>
                  <FieldLabel>واتساپ ثبت‌شده</FieldLabel>
                  <Input
                    dir="ltr"
                    readOnly
                    value={profile?.normalizedWhatsapp || ""}
                    className="bg-muted/40"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="address" required>
                    آدرس
                  </FieldLabel>
                  <Input
                    id="address"
                    placeholder="شهر، منطقه، آدرس کامل"
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      setStepError(null);
                    }}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="email">ایمیل</FieldLabel>
                  <Input
                    id="email"
                    dir="ltr"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setStepError(null);
                    }}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="website">وب‌سایت یا صفحه اجتماعی</FieldLabel>
                  <Input
                    id="website"
                    dir="ltr"
                    placeholder="https://example.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </Field>
              </CardContent>
            </Card>
          )}

          {currentStep.id === "content" && (
            <Card className="overflow-hidden border shadow-sm">
              <CardContent className="space-y-5 p-4 sm:p-6">
                <Field>
                  <FieldLabel htmlFor="productName">نام محصول / خدمت</FieldLabel>
                  <Input
                    id="productName"
                    placeholder="مثلاً آبمیوه طبیعی آفتاب یا مشاوره حقوقی آنلاین"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="productDescription">
                    توضیح کوتاه درباره محصول / خدمت
                  </FieldLabel>
                  <Textarea
                    id="productDescription"
                    rows={3}
                    placeholder="چند جمله درباره ویژگی‌های اصلی، مزیت رقابتی یا ارزش پیشنهادی..."
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel>ویژگی‌ها و مزایا</FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      placeholder="مثلاً ارسال رایگان، کیفیت تضمینی"
                      value={featureInput}
                      onChange={(e) => setFeatureInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (featureInput.trim()) {
                            setFeatures((f) => [...f, featureInput.trim()]);
                            setFeatureInput("");
                          }
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (featureInput.trim()) {
                          setFeatures((f) => [...f, featureInput.trim()]);
                          setFeatureInput("");
                        }
                      }}
                    >
                      افزودن
                    </Button>
                  </div>
                  {features.length > 0 && (
                    <ul className="flex flex-wrap gap-2 pt-1">
                      {features.map((f, i) => (
                        <li key={`${f}-${i}`}>
                          <Badge variant="secondary" className="gap-1 pe-1 font-normal">
                            {f}
                            <button
                              type="button"
                              className="rounded-sm p-0.5 hover:bg-muted"
                              aria-label={`حذف ${f}`}
                              onClick={() =>
                                setFeatures((prev) => prev.filter((_, idx) => idx !== i))
                              }
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="audience">مخاطب هدف</FieldLabel>
                    <Input
                      id="audience"
                      placeholder="مثلاً جوانان ۱۸ تا ۳۵ ساله در کابل"
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="goal">هدف تبلیغ</FieldLabel>
                    <Input
                      id="goal"
                      placeholder="مثلاً افزایش فروش، آگاهی از برند"
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="mainMessage">پیام اصلی تبلیغ</FieldLabel>
                    <Input
                      id="mainMessage"
                      placeholder="جمله کلیدی که مخاطب باید به خاطر بسپارد"
                      value={mainMessage}
                      onChange={(e) => setMainMessage(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="cta">دعوت به اقدام (CTA)</FieldLabel>
                    <Input
                      id="cta"
                      placeholder="مثلاً همین حالا سفارش دهید / با ما تماس بگیرید"
                      value={cta}
                      onChange={(e) => setCta(e.target.value)}
                    />
                  </Field>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep.id === "video" && (
            <Card className="overflow-hidden border shadow-sm">
              <CardContent className="grid gap-5 p-4 sm:grid-cols-2 sm:p-6">
                <Field className="sm:col-span-2">
                  <FieldLabel required>مدت ویدیو</FieldLabel>
                  <DurationInput
                    valueSec={durationSec}
                    onChange={(value) => {
                      setDurationSec(value);
                      setStepError(null);
                    }}
                    hideLabel
                  />
                </Field>

                <div className="sm:col-span-2">
                  <AspectRatioSelector
                    formats={formats || []}
                    value={{ formatId, customRatio: customAspectRatio }}
                    onChange={(next) => {
                      setFormatId(next.formatId);
                      setCustomAspectRatio(next.customRatio);
                      setStepError(null);
                    }}
                  />
                </div>

                <Field>
                  <FieldLabel>زبان ویدیو</FieldLabel>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger>
                      <SelectValue placeholder="انتخاب زبان" />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="tone">لحن ویدیو</FieldLabel>
                  <Input
                    id="tone"
                    placeholder="مثلاً رسمی، دوستانه، هیجانی، الهام‌بخش"
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel>نریتور (گوینده)</FieldLabel>
                  <Select
                    value={narratorProfileId || undefined}
                    onValueChange={setNarratorProfileId}
                    disabled={narratorsLoading || narratorsError || narrators.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          narratorsLoading
                            ? "در حال بارگذاری نریتورها…"
                            : narratorsError
                              ? "خطا در دریافت نریتورها"
                              : narrators.length === 0
                                ? "نریتور فعالی ثبت نشده است"
                                : "انتخاب نریتور"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {narrators.map((narrator) => (
                        <SelectItem key={narrator.id} value={narrator.id}>
                          {narrator.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {narratorsError ? (
                    <p className="text-xs text-destructive">
                      فهرست نریتورها بارگذاری نشد. صفحه را تازه کنید.
                    </p>
                  ) : null}
                </Field>

                <Field className="sm:col-span-2">
                  <FieldLabel>پلتفرم‌های انتشار</FieldLabel>
                  <div className="flex flex-wrap gap-x-4 gap-y-3 rounded-lg border bg-muted/20 px-3.5 py-3">
                    {PLATFORMS.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={platforms.includes(p.id)}
                          onCheckedChange={(c) =>
                            setPlatforms((prev) =>
                              c ? [...prev, p.id] : prev.filter((x) => x !== p.id),
                            )
                          }
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </Field>
              </CardContent>
            </Card>
          )}

          {/* Keep uploader mounted so in-flight uploads survive step changes */}
          <div
            className={cn(
              currentStep.id === "assets" ? "block" : "hidden",
            )}
            aria-hidden={currentStep.id !== "assets"}
          >
            <Card className="overflow-hidden border shadow-sm">
              <CardContent className="p-4 sm:p-6">
                <ClientAssetsUploader
                  assets={assets || []}
                  selectedIds={selectedAssets}
                  onSelectedChange={setSelectedAssets}
                  onUploadStateChange={onAssetUploadStateChange}
                  onRefresh={() => {
                    void refetchAssets();
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </div>

      <div className="sticky bottom-20 z-30 -mx-1 rounded-2xl border bg-background/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/90 lg:bottom-4">
        {!assetUploadState.canSubmit && isLastStep ? (
          <p
            className={cn(
              "mb-2 text-center text-xs",
              assetUploadState.hasFailed
                ? "text-destructive"
                : "text-muted-foreground",
            )}
            dir="rtl"
          >
            {assetUploadState.isUploading
              ? `آپلود ${assetUploadState.activeCount.toLocaleString("fa-AF", { numberingSystem: "latn" })} فایل در جریان است — دکمه ارسال غیرفعال است.`
              : "آپلود ناموفق وجود دارد — ابتدا خطا را برطرف کنید."}
          </p>
        ) : null}
        <div dir="ltr" className="flex items-center justify-between gap-3">
          <div className="min-w-[7.5rem]">
            {!isFirstStep ? (
              <Button
                type="button"
                variant="outline"
                onClick={goPrev}
                disabled={submitMut.isPending}
                className="gap-1.5 transition-all hover:bg-muted"
              >
                <ChevronLeft className="h-4 w-4" />
                <span dir="rtl">قبلی</span>
              </Button>
            ) : (
              <span className="inline-block" />
            )}
          </div>

          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-xs text-muted-foreground" dir="rtl">
              {currentStep.label}
            </p>
          </div>

          <div className="flex min-w-[7.5rem] justify-end">
            {isLastStep ? (
              <Button
                type="button"
                variant="brand"
                size="lg"
                disabled={
                  submitMut.isPending || !assetUploadState.canSubmit
                }
                onClick={handleSubmit}
                className="gap-2 transition-all hover:brightness-105"
              >
                {submitMut.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span dir="rtl">در حال ارسال...</span>
                  </>
                ) : assetUploadState.isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span dir="rtl">در انتظار آپلود...</span>
                  </>
                ) : (
                  <span dir="rtl">ارسال نهایی و ساخت پروژه</span>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                variant="brand"
                onClick={goNext}
                disabled={
                  currentStep.id === "assets" && !assetUploadState.canSubmit
                }
                className="gap-1.5 transition-all hover:brightness-105"
              >
                <span dir="rtl">بعدی</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
