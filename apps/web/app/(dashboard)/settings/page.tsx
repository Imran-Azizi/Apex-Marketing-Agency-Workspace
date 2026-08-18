"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, MessageCircle, Pencil, Shield } from "lucide-react";
import { api, apiGet, ensureCsrf } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useHasPermission } from "@/lib/permissions";
import { PermissionsPanel } from "./_components/permissions-panel";

type SettingRecord = {
  id: string;
  key: string;
  value: unknown;
  updatedAt: string;
};

type WhatsAppDraft = {
  number: string;
  message: string;
};

type ContactDraft = {
  email: string;
  phone: string;
};

const WA_NUMBER_KEY = "whatsapp_number";
const WA_MESSAGE_KEY = "whatsapp_default_message";
const CONTACT_EMAIL_KEY = "contact_email";
const CONTACT_PHONE_KEY = "contact_phone";

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function readWhatsAppNumber(value: unknown): string {
  if (typeof value === "string") return value;
  const obj = asRecord(value);
  return String(obj.number || obj.phone || "");
}

function readWhatsAppMessage(value: unknown): string {
  if (typeof value === "string") return value;
  return String(asRecord(value).message || "");
}

function readContactEmail(value: unknown): string {
  if (typeof value === "string") return value;
  const obj = asRecord(value);
  return String(obj.email || obj.address || obj.value || "");
}

function readContactPhone(value: unknown): string {
  if (typeof value === "string") return value;
  const obj = asRecord(value);
  return String(obj.number || obj.phone || obj.value || "");
}

function findSetting(list: SettingRecord[] | undefined, key: string) {
  return list?.find((s) => s.key === key) ?? null;
}

export default function SettingsPage() {
  const canManagePermissions = useHasPermission("settings.permissions");
  const canEditSettings = useHasPermission("settings.edit");
  const qc = useQueryClient();
  const [tab, setTab] = useState("whatsapp");
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<WhatsAppDraft>({ number: "", message: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactDraft, setContactDraft] = useState<ContactDraft>({
    email: "",
    phone: "",
  });
  const [contactError, setContactError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiGet<SettingRecord[]>("/settings"),
  });

  const numberSetting = findSetting(data, WA_NUMBER_KEY);
  const messageSetting = findSetting(data, WA_MESSAGE_KEY);
  const emailSetting = findSetting(data, CONTACT_EMAIL_KEY);
  const phoneSetting = findSetting(data, CONTACT_PHONE_KEY);
  const number = readWhatsAppNumber(numberSetting?.value);
  const message = readWhatsAppMessage(messageSetting?.value);
  const contactEmail = readContactEmail(emailSetting?.value);
  const contactPhone = readContactPhone(phoneSetting?.value);
  const updatedAt = [numberSetting?.updatedAt, messageSetting?.updatedAt]
    .filter(Boolean)
    .sort()
    .at(-1);
  const contactUpdatedAt = [emailSetting?.updatedAt, phoneSetting?.updatedAt]
    .filter(Boolean)
    .sort()
    .at(-1);

  const saveMut = useMutation({
    mutationFn: async (next: WhatsAppDraft) => {
      await ensureCsrf();
      const digits = next.number.replace(/\D/g, "");

      const numberRes = await api.put(`/settings/${WA_NUMBER_KEY}`, {
        value: { number: digits },
      });
      if (!numberRes.data.success) {
        throw new Error(numberRes.data.error?.message || "خطا در ذخیره شماره");
      }

      const messageRes = await api.put(`/settings/${WA_MESSAGE_KEY}`, {
        value: { message: next.message.trim() },
      });
      if (!messageRes.data.success) {
        throw new Error(messageRes.data.error?.message || "خطا در ذخیره پیام");
      }

      return true;
    },
    onSuccess: () => {
      toast.success("تنظیمات واتساپ ذخیره شد");
      setEditOpen(false);
      setFormError(null);
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "خطا در ذخیره تنظیمات"),
  });

  const saveContactMut = useMutation({
    mutationFn: async (next: ContactDraft) => {
      await ensureCsrf();
      const digits = next.phone.replace(/\D/g, "");
      const emailRes = await api.put(`/settings/${CONTACT_EMAIL_KEY}`, {
        value: { email: next.email.trim() },
      });
      if (!emailRes.data.success) {
        throw new Error(emailRes.data.error?.message || "خطا در ذخیره ایمیل");
      }
      const phoneRes = await api.put(`/settings/${CONTACT_PHONE_KEY}`, {
        value: { number: digits },
      });
      if (!phoneRes.data.success) {
        throw new Error(phoneRes.data.error?.message || "خطا در ذخیره شماره");
      }
      return true;
    },
    onSuccess: () => {
      toast.success("اطلاعات تماس ذخیره شد");
      setContactOpen(false);
      setContactError(null);
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["public-contact-info"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "خطا در ذخیره اطلاعات تماس"),
  });

  const baseline = useMemo(
    () => ({ number, message }),
    [number, message],
  );

  const dirty =
    draft.number.replace(/\D/g, "") !== baseline.number.replace(/\D/g, "") ||
    draft.message.trim() !== baseline.message.trim();

  useEffect(() => {
    if (canManagePermissions) setTab("permissions");
  }, [canManagePermissions]);

  useEffect(() => {
    if (editOpen) {
      setDraft({ number, message });
      setFormError(null);
    }
  }, [editOpen, number, message]);

  function openEditor() {
    setDraft({ number, message });
    setFormError(null);
    setEditOpen(true);
  }

  function handleClose(next: boolean) {
    if (!next && dirty && !saveMut.isPending) {
      const ok = window.confirm("تغییرات ذخیره نشده‌اند. خارج می‌شوید؟");
      if (!ok) return;
    }
    if (!next) setEditOpen(false);
  }

  function submit() {
    const digits = draft.number.replace(/\D/g, "");
    if (digits.length < 8) {
      setFormError("شماره واتساپ معتبر نیست");
      return;
    }
    if (!draft.message.trim()) {
      setFormError("پیام پیش‌فرض نمی‌تواند خالی باشد");
      return;
    }
    setFormError(null);
    saveMut.mutate({ number: digits, message: draft.message.trim() });
  }

  const contactDirty =
    contactDraft.email.trim() !== contactEmail.trim() ||
    contactDraft.phone.replace(/\D/g, "") !== contactPhone.replace(/\D/g, "");

  useEffect(() => {
    if (contactOpen) {
      setContactDraft({ email: contactEmail, phone: contactPhone });
      setContactError(null);
    }
  }, [contactOpen, contactEmail, contactPhone]);

  function openContactEditor() {
    setContactDraft({ email: contactEmail, phone: contactPhone });
    setContactError(null);
    setContactOpen(true);
  }

  function handleContactClose(next: boolean) {
    if (!next && contactDirty && !saveContactMut.isPending) {
      const ok = window.confirm("تغییرات ذخیره نشده‌اند. خارج می‌شوید؟");
      if (!ok) return;
    }
    if (!next) setContactOpen(false);
  }

  function submitContact() {
    const email = contactDraft.email.trim();
    const digits = contactDraft.phone.replace(/\D/g, "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setContactError("ایمیل معتبر وارد کنید");
      return;
    }
    if (digits.length < 8) {
      setContactError("شماره تماس معتبر نیست");
      return;
    }
    setContactError(null);
    saveContactMut.mutate({ email, phone: digits });
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6" dir="rtl">
      <PageHeader
        title="تنظیمات"
        subtitle="پیکربندی سیستم و مدیریت دسترسی کارمندان"
        className="mb-2 sm:mb-4"
      />

      <Tabs dir="rtl" value={tab} onValueChange={setTab}>
        <TabsList
          variant="line"
          className="mb-4 w-full justify-start"
          aria-label="بخش‌های تنظیمات"
        >
          {canManagePermissions ? (
            <TabsTrigger value="permissions" className="gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              دسترسی‌ها
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="whatsapp" className="gap-1.5">
            <MessageCircle className="h-3.5 w-3.5" />
            واتساپ
          </TabsTrigger>
          <TabsTrigger value="contact" className="gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            تماس
          </TabsTrigger>
        </TabsList>

        {canManagePermissions ? (
          <TabsContent value="permissions">
            <PermissionsPanel />
          </TabsContent>
        ) : null}

        <TabsContent value="whatsapp">

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : null}

      {error ? <EmptyState title="بارگذاری تنظیمات ناموفق بود" /> : null}

      {!isLoading && !error ? (
        <section
          className={cn(
            "overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm",
          )}
          aria-labelledby="whatsapp-settings-title"
        >
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 bg-muted/20 px-4 py-4 sm:px-5">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-1 text-start">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id="whatsapp-settings-title"
                    className="text-base font-semibold tracking-tight text-foreground"
                  >
                    واتساپ
                  </h2>
                  <Badge variant="secondary" className="font-normal">
                    ارتباط مشتری
                  </Badge>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  شماره و پیام پیش‌فرض برای شروع گفتگو با مشتری
                </p>
                {updatedAt ? (
                  <p className="text-[11px] text-muted-foreground">
                    آخرین بروزرسانی: {formatDate(updatedAt)}
                  </p>
                ) : null}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-9 gap-1.5"
              onClick={openEditor}
              disabled={!canEditSettings}
            >
              <Pencil className="h-3.5 w-3.5" />
              ویرایش
            </Button>
          </header>

          <div className="space-y-5 p-4 sm:p-5">
            <div className="space-y-2 rounded-xl border border-border/60 bg-background/70 p-4">
              <p className="text-xs font-medium text-muted-foreground">
                شماره واتساپ
              </p>
              {number ? (
                <p
                  className="font-mono text-lg font-semibold tracking-wide text-foreground"
                  dir="ltr"
                >
                  {number}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">هنوز تنظیم نشده</p>
              )}
            </div>

            <div className="space-y-2 rounded-xl border border-border/60 bg-background/70 p-4">
              <p className="text-xs font-medium text-muted-foreground">
                پیام پیش‌فرض
              </p>
              {message ? (
                <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">
                  {message}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">هنوز تنظیم نشده</p>
              )}
            </div>
          </div>
        </section>
      ) : null}
        </TabsContent>

        <TabsContent value="contact">
          {isLoading ? <Skeleton className="h-64 w-full rounded-2xl" /> : null}
          {error ? <EmptyState title="بارگذاری تنظیمات ناموفق بود" /> : null}
          {!isLoading && !error ? (
            <section
              className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
              aria-labelledby="contact-settings-title"
            >
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 bg-muted/20 px-4 py-4 sm:px-5">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 space-y-1 text-start">
                    <h2
                      id="contact-settings-title"
                      className="text-base font-semibold tracking-tight text-foreground"
                    >
                      اطلاعات تماس وب‌سایت
                    </h2>
                    <p className="text-sm leading-6 text-muted-foreground">
                      ایمیل و شماره نمایش‌داده‌شده در صفحه «تماس با ما»
                    </p>
                    {contactUpdatedAt ? (
                      <p className="text-[11px] text-muted-foreground">
                        آخرین بروزرسانی: {formatDate(contactUpdatedAt)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1.5"
                  onClick={openContactEditor}
                  disabled={!canEditSettings}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  ویرایش
                </Button>
              </header>
              <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
                <div className="space-y-2 rounded-xl border border-border/60 bg-background/70 p-4">
                  <p className="text-xs font-medium text-muted-foreground">ایمیل</p>
                  <p className="break-all text-sm font-semibold" dir="ltr">
                    {contactEmail || "هنوز تنظیم نشده"}
                  </p>
                </div>
                <div className="space-y-2 rounded-xl border border-border/60 bg-background/70 p-4">
                  <p className="text-xs font-medium text-muted-foreground">شماره تماس</p>
                  <p className="font-mono text-sm font-semibold" dir="ltr">
                    {contactPhone || "هنوز تنظیم نشده"}
                  </p>
                </div>
              </div>
            </section>
          ) : null}
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={handleClose}>
        <DialogContent
          dir="rtl"
          className="max-h-[90vh] overflow-y-auto text-start sm:max-w-lg"
        >
          <DialogHeader className="space-y-1 text-start sm:text-start">
            <DialogTitle>ویرایش تنظیمات واتساپ</DialogTitle>
            <DialogDescription>
              شماره تماس و پیام پیش‌فرض ارتباط با مشتریان را به‌روزرسانی کنید
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="wa-number">شماره واتساپ</Label>
              <Input
                id="wa-number"
                dir="ltr"
                inputMode="tel"
                value={draft.number}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, number: e.target.value }))
                }
                placeholder="93700000000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa-message">پیام پیش‌فرض</Label>
              <Textarea
                id="wa-message"
                rows={5}
                dir="rtl"
                value={draft.message}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, message: e.target.value }))
                }
                placeholder="سلام، می‌خواهم درباره خدمات…"
              />
            </div>
            {formError ? (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              variant="brand"
              className="gap-2"
              onClick={submit}
              disabled={saveMut.isPending}
            >
              {saveMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              ذخیره تغییرات
            </Button>
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={saveMut.isPending}
            >
              لغو
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={contactOpen} onOpenChange={handleContactClose}>
        <DialogContent
          dir="rtl"
          className="max-h-[90vh] overflow-y-auto text-start sm:max-w-lg"
        >
          <DialogHeader className="space-y-1 text-start">
            <DialogTitle>ویرایش اطلاعات تماس</DialogTitle>
            <DialogDescription>
              ایمیل و شماره تماس صفحه عمومی «تماس با ما» را به‌روزرسانی کنید
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="contact-email-setting">ایمیل</Label>
              <Input
                id="contact-email-setting"
                dir="ltr"
                type="email"
                value={contactDraft.email}
                onChange={(e) =>
                  setContactDraft((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="info@apex.af"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-phone-setting">شماره تماس</Label>
              <Input
                id="contact-phone-setting"
                dir="ltr"
                inputMode="tel"
                value={contactDraft.phone}
                onChange={(e) =>
                  setContactDraft((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="93700000000"
              />
            </div>
            {contactError ? (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {contactError}
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              variant="brand"
              className="gap-2"
              onClick={submitContact}
              disabled={saveContactMut.isPending}
            >
              {saveContactMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              ذخیره تغییرات
            </Button>
            <Button
              variant="outline"
              onClick={() => handleContactClose(false)}
              disabled={saveContactMut.isPending}
            >
              لغو
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
