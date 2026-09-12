export const LEAD_SOURCE_LABELS: Record<string, string> = {
  INSTAGRAM: "اینستاگرام",
  FACEBOOK: "فیسبوک",
  WHATSAPP: "واتساپ",
  WHATSAPP_WEBSITE: "واتساپ / وب‌سایت عمومی",
  TELEGRAM: "تلگرام",
  WEBSITE: "وب‌سایت",
  WEBSITE_CONTACT: "فرم تماس وب‌سایت",
  GOOGLE_SEARCH: "جستجوی گوگل",
  REFERRAL: "معرفی",
  WALK_IN: "مراجعه حضوری",
  PHONE_CALL: "تماس تلفنی",
  ADVERTISEMENT: "تبلیغات",
  MANUAL: "ورود دستی",
  OTHER: "سایر",
};

export const LEAD_SOURCE_CODES = Object.keys(LEAD_SOURCE_LABELS);

/** Display label for stored source value (supports OTHER:detail) */
export function formatLeadSource(source: string | null | undefined): string {
  if (!source) return "—";
  if (source.startsWith("OTHER:")) {
    const detail = source.slice(6).trim();
    return detail ? `سایر: ${detail}` : LEAD_SOURCE_LABELS.OTHER;
  }
  return LEAD_SOURCE_LABELS[source] || source;
}

export function isWhatsAppLeadSource(source: string | null | undefined): boolean {
  return source === "WHATSAPP" || source === "WHATSAPP_WEBSITE";
}

/** Parse stored source into form fields */
export function parseLeadSource(source: string | null | undefined): {
  source: string;
  sourceOther: string;
} {
  if (!source) return { source: "", sourceOther: "" };
  if (source.startsWith("OTHER:")) {
    return { source: "OTHER", sourceOther: source.slice(6) };
  }
  if (LEAD_SOURCE_CODES.includes(source)) {
    return { source, sourceOther: "" };
  }
  return { source: "OTHER", sourceOther: source };
}
