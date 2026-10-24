"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ApiError, apiGet, apiPatch } from "@/lib/api";
import { WhatsAppPhoneInput } from "@/components/shared/whatsapp-phone-input";
import { DurationInput } from "@/components/brief/duration-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  isValidWhatsAppNumber,
  toPhoneInputValue,
  WHATSAPP_VALIDATION_MESSAGE,
} from "@/lib/phone";
import type { ProjectCustomerOverviewData } from "./project-customer-overview";

const PLATFORMS = [
  { id: "Facebook", label: "فیسبوک" },
  { id: "Instagram", label: "اینستاگرام" },
  { id: "TikTok", label: "تیک‌تاک" },
  { id: "YouTube", label: "یوتیوب" },
  { id: "Other", label: "سایر" },
] as const;

const LANGUAGE_OPTIONS = [
  { value: "fa", label: "فارسی / دری" },
  { value: "ps", label: "پشتو" },
  { value: "en", label: "انگلیسی" },
] as const;

function asString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

function Field({
  label,
  htmlFor,
  children,
  wide,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

export function EditCustomerBriefButton({
  onClick,
  label = "ویرایش",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 rounded-lg"
      onClick={onClick}
    >
      <Pencil className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

type CustomerForm = {
  personName: string;
  jobTitle: string;
  companyName: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  address: string;
  city: string;
};

function customerDefaults(project: ProjectCustomerOverviewData): CustomerForm {
  const brief = project.brief || {};
  const phone =
    asString(brief.phone) || project.crmCustomer.phone || "";
  const whatsapp =
    asString(brief.whatsapp) ||
    project.crmCustomer.normalizedWhatsapp ||
    project.crmCustomer.whatsappRaw ||
    "";
  return {
    personName:
      asString(brief.personName) || project.crmCustomer.personName || "",
    jobTitle: asString(brief.jobTitle) || project.crmCustomer.jobTitle || "",
    companyName:
      asString(brief.companyName) || project.crmCustomer.companyName || "",
    phone: toPhoneInputValue(phone) || phone,
    whatsapp: toPhoneInputValue(whatsapp) || whatsapp,
    email: asString(brief.email) || project.crmCustomer.email || "",
    website: asString(brief.website),
    address: asString(brief.address) || project.crmCustomer.address || "",
    city: asString(brief.city) || project.crmCustomer.city || "",
  };
}

export function EditCustomerDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectCustomerOverviewData;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => customerDefaults(project));

  useEffect(() => {
    if (open) setForm(customerDefaults(project));
  }, [open, project]);

  const set =
    (key: keyof CustomerForm) =>
    (value: string) =>
      setForm((current) => ({ ...current, [key]: value }));

  const save = useMutation({
    mutationFn: () => {
      if (!form.personName.trim()) {
        throw new Error("نام مشتری الزامی است.");
      }
      if (form.phone.trim() && !isValidWhatsAppNumber(form.phone)) {
        throw new Error(WHATSAPP_VALIDATION_MESSAGE);
      }
      if (form.whatsapp.trim() && !isValidWhatsAppNumber(form.whatsapp)) {
        throw new Error(WHATSAPP_VALIDATION_MESSAGE);
      }
      return apiPatch(`/projects/${project.id}/brief`, {
        personName: form.personName.trim(),
        jobTitle: form.jobTitle.trim() || null,
        companyName: form.companyName.trim() || null,
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
        website: form.website.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
      });
    },
    onSuccess: async () => {
      toast.success("اطلاعات مشتری به‌روزرسانی شد");
      onOpenChange(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", project.id] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["crm-customer"] }),
      ]);
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "ذخیره ناموفق بود",
      );
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (save.isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto text-start sm:max-w-2xl" dir="rtl">
        <DialogHeader className="text-start">
          <DialogTitle className="text-start">ویرایش اطلاعات مشتری</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="نام" htmlFor="edit-customer-name">
            <Input
              id="edit-customer-name"
              value={form.personName}
              onChange={(e) => set("personName")(e.target.value)}
              disabled={save.isPending}
            />
          </Field>
          <Field label="سمت" htmlFor="edit-customer-job">
            <Input
              id="edit-customer-job"
              value={form.jobTitle}
              onChange={(e) => set("jobTitle")(e.target.value)}
              disabled={save.isPending}
            />
          </Field>
          <Field label="شرکت / سازمان" htmlFor="edit-customer-company" wide>
            <Input
              id="edit-customer-company"
              value={form.companyName}
              onChange={(e) => set("companyName")(e.target.value)}
              disabled={save.isPending}
            />
          </Field>
          <Field label="تلفن">
            <WhatsAppPhoneInput
              value={form.phone}
              onChange={set("phone")}
              disabled={save.isPending}
            />
          </Field>
          <Field label="واتساپ">
            <WhatsAppPhoneInput
              value={form.whatsapp}
              onChange={set("whatsapp")}
              disabled={save.isPending}
            />
          </Field>
          <Field label="ایمیل" htmlFor="edit-customer-email">
            <Input
              id="edit-customer-email"
              dir="ltr"
              className="text-end"
              value={form.email}
              onChange={(e) => set("email")(e.target.value)}
              disabled={save.isPending}
            />
          </Field>
          <Field label="وب‌سایت" htmlFor="edit-customer-website">
            <Input
              id="edit-customer-website"
              dir="ltr"
              className="text-end"
              value={form.website}
              onChange={(e) => set("website")(e.target.value)}
              disabled={save.isPending}
            />
          </Field>
          <Field label="آدرس" htmlFor="edit-customer-address" wide>
            <Input
              id="edit-customer-address"
              value={form.address}
              onChange={(e) => set("address")(e.target.value)}
              disabled={save.isPending}
            />
          </Field>
          <Field label="شهر" htmlFor="edit-customer-city">
            <Input
              id="edit-customer-city"
              value={form.city}
              onChange={(e) => set("city")(e.target.value)}
              disabled={save.isPending}
            />
          </Field>
        </div>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={save.isPending}
          >
            انصراف
          </Button>
          <Button
            variant="brand"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            ذخیره
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type BriefForm = {
  productName: string;
  productDescription: string;
  featuresText: string;
  audience: string;
  goal: string;
  mainMessage: string;
  cta: string;
  tone: string;
  language: string;
  durationSec: number;
  formatId: string;
  customAspectRatio: string;
  serviceId: string;
  platforms: string[];
};

function briefDefaults(project: ProjectCustomerOverviewData): BriefForm {
  const brief = project.brief || {};
  const platforms = Array.isArray(project.platforms)
    ? project.platforms.map(String)
    : asStringList(project.platforms);
  return {
    productName: asString(brief.productName),
    productDescription: asString(brief.productDescription),
    featuresText: asStringList(brief.features).join("\n"),
    audience: asString(brief.audience),
    goal: asString(brief.goal),
    mainMessage: asString(brief.mainMessage),
    cta: asString(brief.cta),
    tone: asString(brief.tone) || project.tone || "",
    language: project.language || asString(brief.language) || "fa",
    durationSec: Number(project.durationSec || asString(brief.durationSec) || 0) || 30,
    formatId: project.format?.id || "",
    customAspectRatio: asString(brief.customAspectRatio),
    serviceId: project.service?.id || "",
    platforms,
  };
}

export function EditBriefDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectCustomerOverviewData;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => briefDefaults(project));

  useEffect(() => {
    if (open) setForm(briefDefaults(project));
  }, [open, project]);

  const formatsQuery = useQuery({
    queryKey: ["formats"],
    queryFn: () =>
      apiGet<Array<{ id: string; name: string; ratio: string }>>("/public/formats"),
    enabled: open,
  });

  const servicesQuery = useQuery({
    queryKey: ["public-services-brief-edit"],
    queryFn: () =>
      apiGet<Array<{ id: string; name: string; title?: string }>>(
        "/public/services",
      ),
    enabled: open,
  });

  const formats = formatsQuery.data || [];
  const services = useMemo(() => {
    const list = (servicesQuery.data || []).map((s) => ({
      id: s.id,
      name: s.title || s.name,
    }));
    if (
      project.service?.id &&
      !list.some((s) => s.id === project.service?.id)
    ) {
      return [
        { id: project.service.id, name: project.service.name },
        ...list,
      ];
    }
    return list;
  }, [servicesQuery.data, project.service]);

  const set =
    <K extends keyof BriefForm>(key: K) =>
    (value: BriefForm[K]) =>
      setForm((current) => ({ ...current, [key]: value }));

  const togglePlatform = (id: string) => {
    setForm((current) => {
      const has = current.platforms.includes(id);
      return {
        ...current,
        platforms: has
          ? current.platforms.filter((p) => p !== id)
          : [...current.platforms, id],
      };
    });
  };

  const save = useMutation({
    mutationFn: () => {
      const features = form.featuresText
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 20);

      if (form.customAspectRatio.trim()) {
        if (!/^\d{1,3}:\d{1,3}$/.test(form.customAspectRatio.trim())) {
          throw new Error("نسبت تصویر سفارشی باید مثل 9:16 باشد.");
        }
      }

      return apiPatch(`/projects/${project.id}/brief`, {
        productName: form.productName.trim() || null,
        productDescription: form.productDescription.trim() || null,
        features,
        audience: form.audience.trim() || null,
        goal: form.goal.trim() || null,
        mainMessage: form.mainMessage.trim() || null,
        cta: form.cta.trim() || null,
        tone: form.tone.trim() || null,
        language: form.language.trim() || null,
        durationSec: form.durationSec > 0 ? form.durationSec : null,
        formatId: form.customAspectRatio.trim()
          ? null
          : form.formatId || null,
        customAspectRatio: form.customAspectRatio.trim() || null,
        serviceId: form.serviceId || null,
        platforms: form.platforms,
      });
    },
    onSuccess: async () => {
      toast.success("بریف پروژه به‌روزرسانی شد");
      onOpenChange(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", project.id] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
      ]);
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "ذخیره ناموفق بود",
      );
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (save.isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto text-start sm:max-w-2xl" dir="rtl">
        <DialogHeader className="text-start">
          <DialogTitle className="text-start">ویرایش بریف پروژه</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2">
            <h3 className="text-sm font-semibold sm:col-span-2">
              اطلاعات پایه و اهداف
            </h3>
            <Field label="نام محصول / خدمت" htmlFor="edit-brief-product">
              <Input
                id="edit-brief-product"
                value={form.productName}
                onChange={(e) => set("productName")(e.target.value)}
                disabled={save.isPending}
              />
            </Field>
            <Field label="خدمت">
              <Select
                dir="rtl"
                value={form.serviceId || "__none__"}
                onValueChange={(v) =>
                  set("serviceId")(v === "__none__" ? "" : v)
                }
                disabled={save.isPending}
              >
                <SelectTrigger dir="rtl">
                  <SelectValue placeholder="انتخاب خدمت" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="__none__">بدون خدمت</SelectItem>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="توضیح کوتاه" htmlFor="edit-brief-desc" wide>
              <Textarea
                id="edit-brief-desc"
                rows={3}
                value={form.productDescription}
                onChange={(e) => set("productDescription")(e.target.value)}
                disabled={save.isPending}
              />
            </Field>
            <Field
              label="ویژگی‌ها و مزایا (هر خط یک مورد)"
              htmlFor="edit-brief-features"
              wide
            >
              <Textarea
                id="edit-brief-features"
                rows={3}
                value={form.featuresText}
                onChange={(e) => set("featuresText")(e.target.value)}
                disabled={save.isPending}
                placeholder={"ویژگی ۱\nویژگی ۲"}
              />
            </Field>
            <Field label="مخاطب هدف" htmlFor="edit-brief-audience">
              <Input
                id="edit-brief-audience"
                value={form.audience}
                onChange={(e) => set("audience")(e.target.value)}
                disabled={save.isPending}
              />
            </Field>
            <Field label="هدف تبلیغ" htmlFor="edit-brief-goal">
              <Input
                id="edit-brief-goal"
                value={form.goal}
                onChange={(e) => set("goal")(e.target.value)}
                disabled={save.isPending}
              />
            </Field>
            <Field label="پیام اصلی" htmlFor="edit-brief-message" wide>
              <Textarea
                id="edit-brief-message"
                rows={2}
                value={form.mainMessage}
                onChange={(e) => set("mainMessage")(e.target.value)}
                disabled={save.isPending}
              />
            </Field>
            <Field label="CTA" htmlFor="edit-brief-cta" wide>
              <Input
                id="edit-brief-cta"
                value={form.cta}
                onChange={(e) => set("cta")(e.target.value)}
                disabled={save.isPending}
              />
            </Field>
            <Field label="لحن برند" htmlFor="edit-brief-tone" wide>
              <Input
                id="edit-brief-tone"
                value={form.tone}
                onChange={(e) => set("tone")(e.target.value)}
                disabled={save.isPending}
              />
            </Field>
          </section>

          <section className="grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-2">
            <h3 className="text-sm font-semibold sm:col-span-2">
              دستورالعمل ویدیو
            </h3>
            <div className="sm:col-span-2">
              <DurationInput
                valueSec={form.durationSec}
                onChange={(sec) => set("durationSec")(sec)}
              />
            </div>
            <Field label="نسبت تصویر">
              <Select
                dir="rtl"
                value={
                  form.customAspectRatio
                    ? "__custom__"
                    : form.formatId || "__none__"
                }
                onValueChange={(v) => {
                  if (v === "__custom__") {
                    setForm((c) => ({
                      ...c,
                      formatId: "",
                      customAspectRatio: c.customAspectRatio || "9:16",
                    }));
                    return;
                  }
                  if (v === "__none__") {
                    setForm((c) => ({
                      ...c,
                      formatId: "",
                      customAspectRatio: "",
                    }));
                    return;
                  }
                  setForm((c) => ({
                    ...c,
                    formatId: v,
                    customAspectRatio: "",
                  }));
                }}
                disabled={save.isPending}
              >
                <SelectTrigger dir="rtl">
                  <SelectValue placeholder="انتخاب نسبت" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="__none__">ثبت نشده</SelectItem>
                  {formats.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name} ({f.ratio})
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom__">سفارشی</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {form.customAspectRatio ? (
              <Field label="نسبت سفارشی" htmlFor="edit-brief-ratio">
                <Input
                  id="edit-brief-ratio"
                  dir="ltr"
                  className="text-end"
                  placeholder="9:16"
                  value={form.customAspectRatio}
                  onChange={(e) => set("customAspectRatio")(e.target.value)}
                  disabled={save.isPending}
                />
              </Field>
            ) : null}
            <Field label="زبان">
              <Select
                dir="rtl"
                value={form.language || "fa"}
                onValueChange={(v) => set("language")(v)}
                disabled={save.isPending}
              >
                <SelectTrigger dir="rtl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="space-y-2 sm:col-span-2">
              <Label>پلتفرم‌ها</Label>
              <div className="flex flex-wrap gap-3">
                {PLATFORMS.map((p) => {
                  const checked = form.platforms.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => togglePlatform(p.id)}
                        disabled={save.isPending}
                      />
                      {p.label}
                    </label>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={save.isPending}
          >
            انصراف
          </Button>
          <Button
            variant="brand"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            ذخیره
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
