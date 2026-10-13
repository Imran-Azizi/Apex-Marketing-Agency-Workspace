"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { apiPut } from "@/lib/api";
import type { CompanyProfile, ContractWorkspace } from "@/lib/contract-workspace";
import { toEnglishDigits } from "@/lib/utils";
import { CompanyProfileView } from "@/components/contract-content/company-profile-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PanelHeader } from "./panel-header";

export type CompanyDefaults = {
  companyName: string;
  address: string;
  contactNumber: string;
};

type CompanyForm = {
  companyName: string;
  companyIntro: string;
  features: string[];
  audience: string;
  goal: string;
  mainMessage: string;
  cta: string;
  address: string;
  contactNumbers: string[];
};

const PHONE_PATTERN = /^\+?[\d\s\-()]{5,24}$/;

function toForm(company: CompanyProfile | null, defaults: CompanyDefaults): CompanyForm {
  return {
    companyName: company?.companyName ?? defaults.companyName,
    companyIntro: company?.companyIntro ?? "",
    features: company?.features ?? [],
    audience: company?.audience ?? "",
    goal: company?.goal ?? "",
    mainMessage: company?.mainMessage ?? "",
    cta: company?.cta ?? "",
    address: company?.address ?? defaults.address,
    contactNumbers:
      company?.contactNumbers ?? (defaults.contactNumber ? [defaults.contactNumber] : []),
  };
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <Label htmlFor={htmlFor} className="text-sm font-semibold">
      {children}
    </Label>
  );
}

/** Text input with an «افزودن» button that collects values as removable chips. */
function ListInput({
  id,
  values,
  onChange,
  placeholder,
  ltr,
  normalize,
  validate,
}: {
  id: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  ltr?: boolean;
  normalize?: (value: string) => string;
  validate?: (value: string) => string | null;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const value = (normalize ? normalize(draft) : draft).trim();
    if (!value) return;
    const error = validate?.(value);
    if (error) {
      toast.error(error);
      return;
    }
    if (!values.includes(value)) onChange([...values, value]);
    setDraft("");
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      add();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id={id}
          dir={ltr ? "ltr" : undefined}
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          className={ltr ? "text-right" : undefined}
        />
        <Button type="button" variant="outline" className="shrink-0" onClick={add}>
          <Plus className="h-4 w-4" />
          افزودن
        </Button>
      </div>
      {values.length ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 py-1 pe-1 ps-3 text-xs font-medium"
            >
              <span dir={ltr ? "ltr" : undefined}>{value}</span>
              <button
                type="button"
                className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label={`حذف ${value}`}
                onClick={() => onChange(values.filter((item) => item !== value))}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CompanyEditor({
  projectId,
  initial,
  onCancel,
  onSaved,
}: {
  projectId: string;
  initial: CompanyForm;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initial);
  const set = <K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = useMutation({
    mutationFn: () => {
      if (!form.companyName.trim()) throw new Error("نام شرکت الزامی است.");
      return apiPut<CompanyProfile>(`/projects/${projectId}/workspace/company`, {
        ...form,
        companyName: form.companyName.trim(),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contract-workspace", projectId] });
      toast.success("اطلاعات شرکت ذخیره شد");
      onSaved();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "ذخیره ناموفق بود");
    },
  });

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!save.isPending) save.mutate();
      }}
    >
      <div className="space-y-2">
        <FieldLabel htmlFor="company-name">نام شرکت</FieldLabel>
        <Input
          id="company-name"
          value={form.companyName}
          placeholder="مثلاً شرکت تجارتی آفتاب"
          onChange={(event) => set("companyName", event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <FieldLabel htmlFor="company-intro">معرفی شرکت</FieldLabel>
        <Textarea
          id="company-intro"
          rows={4}
          value={form.companyIntro}
          placeholder="چند جمله درباره فعالیت‌های اصلی، مزیت رقابتی یا ارزش پیشنهادی شرکت..."
          onChange={(event) => set("companyIntro", event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <FieldLabel htmlFor="company-features">ویژگی‌ها و مزایا</FieldLabel>
        <ListInput
          id="company-features"
          values={form.features}
          onChange={(values) => set("features", values)}
          placeholder="مثلاً ارسال رایگان، کیفیت تضمینی"
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <FieldLabel htmlFor="company-audience">مخاطب هدف</FieldLabel>
          <Input
            id="company-audience"
            value={form.audience}
            placeholder="مثلاً جوانان ۱۸ تا ۳۵ ساله در کابل"
            onChange={(event) => set("audience", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="company-goal">هدف تبلیغ</FieldLabel>
          <Input
            id="company-goal"
            value={form.goal}
            placeholder="مثلاً افزایش فروش، آگاهی از برند"
            onChange={(event) => set("goal", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="company-message">پیام اصلی تبلیغ</FieldLabel>
          <Input
            id="company-message"
            value={form.mainMessage}
            placeholder="جمله کلیدی که مخاطب باید به خاطر بسپارد"
            onChange={(event) => set("mainMessage", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="company-cta">دعوت به اقدام (CTA)</FieldLabel>
          <Input
            id="company-cta"
            value={form.cta}
            placeholder="مثلاً همین حالا سفارش دهید / با ما تماس بگیرید"
            onChange={(event) => set("cta", event.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <FieldLabel htmlFor="company-address">آدرس دقیق شرکت</FieldLabel>
        <Textarea
          id="company-address"
          rows={2}
          value={form.address}
          placeholder="ولایت، ناحیه، سرک، نام ساختمان و منزل"
          onChange={(event) => set("address", event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <FieldLabel htmlFor="company-phones">شماره‌های تماس شرکت</FieldLabel>
        <ListInput
          id="company-phones"
          ltr
          values={form.contactNumbers}
          onChange={(values) => set("contactNumbers", values)}
          placeholder="+93 7XX XXX XXX"
          normalize={toEnglishDigits}
          validate={(value) => (PHONE_PATTERN.test(value) ? null : "شماره تماس معتبر نیست")}
        />
      </div>
      <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={save.isPending}>
          انصراف
        </Button>
        <Button type="submit" variant="brand" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          ذخیره اطلاعات شرکت
        </Button>
      </div>
    </form>
  );
}

export function CompanyPanel({
  projectId,
  workspace,
  defaults,
  canEdit,
}: {
  projectId: string;
  workspace: ContractWorkspace;
  defaults: CompanyDefaults;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const company = workspace.company;

  return (
    <div className="space-y-5">
      <PanelHeader
        icon={<Building2 className="h-5 w-5" />}
        title="اطلاعات شرکت"
        actions={
          !editing && company && canEdit ? (
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />
              ویرایش
            </Button>
          ) : null
        }
      />

      {editing ? (
        <CompanyEditor
          projectId={projectId}
          initial={toForm(company, defaults)}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      ) : company ? (
        <CompanyProfileView company={company} />
      ) : (
        <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-10 text-center">
          <p className="font-semibold">اطلاعات شرکت هنوز ثبت نشده</p>
          {canEdit ? (
            <Button variant="brand" className="mt-4 rounded-xl" onClick={() => setEditing(true)}>
              <Plus className="h-4 w-4" />
              ثبت اطلاعات شرکت
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
