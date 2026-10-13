"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  Download,
  Globe,
  Loader2,
  MessageCircle,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import {
  buildCalendarMessage,
  portalContractUrl,
  type ContentCalendar,
  type SharedPdf,
  type ShareInfo,
} from "@/lib/contract-workspace";
import {
  buildCalendarPdf,
  downloadFile,
  type CalendarPdfContext,
} from "@/lib/content-calendar-pdf";
import { UPLOAD_PURPOSE } from "@/lib/media-manager";
import { uploadFileWithProgress } from "@/lib/upload";
import { buildWhatsAppChatUrl, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ShareResult = {
  sharedAt: string;
  channel: "PORTAL" | "WHATSAPP";
  portalPath: string;
  hasPortalAccount: boolean;
  pdf: SharedPdf | null;
};

type Action = "portal" | "whatsapp" | "download";

/** Shows when the content was last sent and whether it changed since. */
export function ShareStatus({
  share,
  updatedAt,
}: {
  share: ShareInfo | null | undefined;
  updatedAt?: string | null;
}) {
  if (!share) {
    return (
      <Badge variant="outline" className="font-medium text-muted-foreground">
        ارسال نشده
      </Badge>
    );
  }
  const changedSince =
    updatedAt && new Date(updatedAt).getTime() > new Date(share.sharedAt).getTime() + 1000;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="success" className="gap-1 font-medium">
        <CheckCircle2 className="h-3 w-3" />
        ارسال‌شده · {formatDateTime(share.sharedAt)}
      </Badge>
      {changedSince ? (
        <Badge variant="warning" className="font-medium">
          تغییرات بعد از ارسال
        </Badge>
      ) : null}
    </div>
  );
}

function openPendingWindow(): Window | null {
  const win = window.open("", "_blank");
  if (!win) return null;
  try {
    win.opener = null;
    win.document.title = "در حال آماده‌سازی…";
    win.document.body.innerHTML =
      '<p dir="rtl" style="font-family:Tahoma,sans-serif;padding:32px;color:#374151">در حال آماده‌سازی PDF تقویم محتوایی و باز کردن واتساپ…</p>';
  } catch {
    /* cross-origin guards — the window is still usable for navigation */
  }
  return win;
}

/** Sends a content calendar to the customer as a PDF via the portal or WhatsApp. */
export function CalendarShareMenu({
  projectId,
  calendar,
  context,
  customerWhatsapp,
  hasPortalAccount,
  disabled,
}: {
  projectId: string;
  calendar: ContentCalendar;
  context: CalendarPdfContext;
  customerWhatsapp: string | null;
  hasPortalAccount: boolean;
  disabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<Action | null>(null);
  const whatsappReady = Boolean(buildWhatsAppChatUrl(customerWhatsapp));

  const publish = async (channel: "PORTAL" | "WHATSAPP") => {
    const file = await buildCalendarPdf(calendar, context);
    const uploaded = await uploadFileWithProgress(file, {
      purpose: UPLOAD_PURPOSE.PORTAL_ASSET,
      assetKind: "BRANDBOOK",
    });
    const result = await apiPost<ShareResult>(`/projects/${projectId}/workspace/share`, {
      section: "CALENDAR",
      calendarId: calendar.id,
      channel,
      pdf: {
        name: uploaded.name || file.name,
        storageKey: uploaded.key,
        sizeBytes: uploaded.sizeBytes ?? file.size,
      },
    });
    await queryClient.invalidateQueries({ queryKey: ["contract-workspace", projectId] });
    if (!result.pdf?.url) throw new Error("لینک فایل PDF ساخته نشد");
    return result;
  };

  const warnNoPortal = () =>
    toast.warning(
      "مشتری هنوز حساب پورتال ندارد؛ بعد از ثبت‌نام، این تقویم در پورتال او نمایش داده می‌شود.",
    );

  const sendToPortal = async () => {
    setBusy("portal");
    try {
      await publish("PORTAL");
      if (hasPortalAccount) toast.success("PDF تقویم محتوایی در پورتال مشتری ارسال شد");
      else warnNoPortal();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ارسال ناموفق بود");
    } finally {
      setBusy(null);
    }
  };

  const sendToWhatsapp = async () => {
    if (!whatsappReady) {
      toast.error("شماره واتساپ معتبر برای این مشتری ثبت نشده است");
      return;
    }
    // Opened synchronously so the browser does not block it as a pop-up.
    const pending = openPendingWindow();
    setBusy("whatsapp");
    try {
      const result = await publish("WHATSAPP");
      const message = buildCalendarMessage({
        calendar,
        contractTitle: context.contractTitle,
        customerName: context.customerName,
        pdfUrl: result.pdf!.url,
        portalUrl: hasPortalAccount ? portalContractUrl(projectId, "calendar") : null,
      });
      const url = buildWhatsAppChatUrl(customerWhatsapp, message)!;
      if (pending && !pending.closed) {
        pending.location.replace(url);
        toast.success("PDF تقویم محتوایی آماده شد و گفتگوی واتساپ مشتری باز شد");
      } else {
        toast.success("PDF تقویم محتوایی آماده شد", {
          action: { label: "باز کردن واتساپ", onClick: () => window.open(url, "_blank", "noopener") },
          duration: 15_000,
        });
      }
    } catch (error) {
      pending?.close();
      toast.error(error instanceof Error ? error.message : "ارسال ناموفق بود");
    } finally {
      setBusy(null);
    }
  };

  const downloadPdf = async () => {
    setBusy("download");
    try {
      const file = await buildCalendarPdf(calendar, context);
      downloadFile(file, file.name);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ساخت PDF ناموفق بود");
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button
          variant="brand"
          size="sm"
          className="rounded-xl"
          disabled={disabled || Boolean(busy)}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {busy === "download" ? "در حال ساخت PDF…" : busy ? "در حال ارسال…" : "ارسال به مشتری"}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem className="gap-2" onSelect={() => void sendToPortal()}>
          <Globe className="h-4 w-4 text-brand" />
          ارسال PDF به پورتال مشتری
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2"
          disabled={!whatsappReady}
          onSelect={() => void sendToWhatsapp()}
        >
          <MessageCircle className="h-4 w-4 text-emerald-600" />
          {whatsappReady ? "ارسال PDF از طریق واتساپ" : "شماره واتساپ مشتری ثبت نشده"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2" onSelect={() => void downloadPdf()}>
          <Download className="h-4 w-4 text-muted-foreground" />
          دانلود PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

