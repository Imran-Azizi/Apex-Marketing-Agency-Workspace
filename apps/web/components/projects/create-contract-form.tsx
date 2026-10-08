"use client";

import { useRef, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import {
  isValidWhatsAppNumber,
  toPhoneInputValue,
  WHATSAPP_VALIDATION_MESSAGE,
} from "@/lib/phone";
import { WhatsAppPhoneInput } from "@/components/shared/whatsapp-phone-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export type ContractCustomerProfile = {
  personName: string;
  companyName: string | null;
  phone: string | null;
  normalizedWhatsapp: string;
  address: string | null;
  email: string | null;
  jobTitle: string | null;
};

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
    <Label htmlFor={htmlFor} className="text-sm font-medium">
      {children}
      {required ? <span className="ms-1 text-destructive">*</span> : null}
    </Label>
  );
}

function createKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function CreateContractForm({
  crmCustomerId,
  profile,
  onCreated,
}: {
  crmCustomerId: string;
  profile: ContractCustomerProfile;
  onCreated: (project: { id: string }) => void;
}) {
  const idempotencyKey = useRef(createKey());
  const [personName, setPersonName] = useState(profile.personName || "");
  const [jobTitle, setJobTitle] = useState(profile.jobTitle || "");
  const [companyName, setCompanyName] = useState(profile.companyName || "");
  const [phone, setPhone] = useState(
    toPhoneInputValue(profile.phone) ||
      toPhoneInputValue(profile.normalizedWhatsapp) ||
      profile.phone ||
      "",
  );
  const [whatsapp, setWhatsapp] = useState(
    toPhoneInputValue(profile.normalizedWhatsapp) ||
      toPhoneInputValue(profile.phone) ||
      profile.normalizedWhatsapp ||
      "",
  );
  const [address, setAddress] = useState(profile.address || "");
  const [email, setEmail] = useState(profile.email || "");
  const [website, setWebsite] = useState("");

  const createMut = useMutation({
    mutationFn: () => {
      if (!personName.trim() || !jobTitle.trim() || !companyName.trim() || !address.trim()) {
        throw new Error("نام، سمت، شرکت و آدرس الزامی هستند.");
      }
      if (!isValidWhatsAppNumber(phone) || !isValidWhatsAppNumber(whatsapp)) {
        throw new Error(WHATSAPP_VALIDATION_MESSAGE);
      }
      const trimmedEmail = email.trim();
      if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        throw new Error("ایمیل معتبر نیست.");
      }

      return apiPost<{ id: string }>("/projects/contracts", {
        crmCustomerId,
        idempotencyKey: idempotencyKey.current,
        personName: personName.trim(),
        jobTitle: jobTitle.trim(),
        companyName: companyName.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim(),
        address: address.trim(),
        email: trimmedEmail || undefined,
        website: website.trim() || undefined,
      });
    },
    onSuccess: (project) => {
      toast.success("قرارداد ایجاد شد. حالا می‌توانید ویدیوها را اضافه کنید.");
      onCreated(project);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "ایجاد قرارداد ناموفق بود");
    },
  });

  return (
    <form
      className="mx-auto max-w-4xl space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (createMut.isPending) return;
        createMut.mutate();
      }}
    >
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
        قرارداد چندویدیویی
      </h1>

      <Card className="border shadow-sm">
        <CardContent className="grid gap-5 p-4 sm:grid-cols-2 sm:p-6">
          <div className="space-y-1 sm:col-span-2">
            <h2 className="text-base font-semibold">اطلاعات مشتری</h2>
            <p className="text-xs text-muted-foreground">
              همین اطلاعات برای همه ویدیوهای این قرارداد استفاده می‌شود.
            </p>
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="person-name" required>
              نام مشتری
            </FieldLabel>
            <Input
              id="person-name"
              value={personName}
              onChange={(event) => setPersonName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="job-title" required>
              سمت
            </FieldLabel>
            <Input
              id="job-title"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <FieldLabel htmlFor="company-name" required>
              نام شرکت
            </FieldLabel>
            <Input
              id="company-name"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="customer-phone" required>
              تلفن
            </FieldLabel>
            <WhatsAppPhoneInput
              id="customer-phone"
              value={phone}
              onChange={setPhone}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="customer-whatsapp" required>
              واتساپ
            </FieldLabel>
            <WhatsAppPhoneInput
              id="customer-whatsapp"
              value={whatsapp}
              onChange={setWhatsapp}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <FieldLabel htmlFor="customer-address" required>
              آدرس
            </FieldLabel>
            <Input
              id="customer-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="customer-email">ایمیل</FieldLabel>
            <Input
              id="customer-email"
              type="email"
              dir="ltr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel htmlFor="customer-website">وب‌سایت</FieldLabel>
            <Input
              id="customer-website"
              dir="ltr"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          type="submit"
          variant="brand"
          className="rounded-xl"
          disabled={createMut.isPending}
        >
          {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          ذخیره قرارداد
        </Button>
      </div>
    </form>
  );
}
