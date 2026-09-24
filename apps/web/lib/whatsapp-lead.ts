import { z } from "zod";
import { whatsappFieldSchema } from "@/lib/phone";
import { isSafeWhatsAppHref } from "@/lib/contact";

export const whatsappLeadFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "نام باید حداقل ۲ حرف باشد")
    .max(80, "نام نباید بیشتر از ۸۰ حرف باشد"),
  whatsapp: whatsappFieldSchema,
  companyName: z
    .string()
    .trim()
    .min(2, "نام شرکت باید حداقل ۲ حرف باشد")
    .max(120, "نام شرکت بیش از حد طولانی است"),
  jobTitle: z
    .string()
    .trim()
    .min(2, "موقف باید حداقل ۲ حرف باشد")
    .max(120, "موقف بیش از حد طولانی است"),
});

export type WhatsAppLeadFormValues = z.infer<typeof whatsappLeadFormSchema>;

export type WhatsAppLeadSubmitResult = {
  crmCustomerId: string;
  customerCode: string | null;
  leadCreated: boolean;
  leadDuplicate: boolean;
  leadReopened: boolean;
  whatsappUrl: string;
};

/**
 * Open WhatsApp after lead success. Prefers a new tab/app; falls back to same-tab navigation.
 */
export function openWhatsAppAfterLead(
  url: string | null | undefined,
  fallbackHref?: string | null,
): boolean {
  const candidate = [url, fallbackHref].find((href) => isSafeWhatsAppHref(href));
  if (!candidate) return false;

  const popup = window.open(candidate, "_blank", "noopener,noreferrer");
  if (popup) {
    try {
      popup.opener = null;
    } catch {
      // Ignore cross-origin / browser restrictions.
    }
    return true;
  }

  window.location.assign(candidate);
  return true;
}
