import { toEnglishDigits } from "@/lib/utils";

export type ProjectKind = "SINGLE" | "CONTRACT" | "CHILD";

export type ContractVideoStats = {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  canceled: number;
  progressPercent: number;
};

export function formatCount(value: number): string {
  return value.toLocaleString("fa-AF", { numberingSystem: "latn" });
}

export type ContractScope = {
  videoCount: number | null;
  posterCount: number | null;
  startDate: string | null;
  endDate: string | null;
  agreedTerms: string | null;
  hasCommercials: boolean;
  contractLocked: boolean;
  canViewCommercials: boolean;
};

export type ContractScopeInput = {
  agreedPrice: string;
  agreedTerms: string;
  videoCount: string;
  posterCount: string;
  startDate: string;
  endDate: string;
};

export const CONTRACT_PERIOD_MESSAGE =
  "تاریخ ختم قرارداد نمی‌تواند قبل از تاریخ شروع باشد.";

/** Accepts Persian/Arabic digits and thousands separators; NaN when not numeric, null when empty. */
export function parseNumberInput(value: string): number | null {
  const raw = toEnglishDigits(value).replace(/[,٬\s]/g, "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

/** `YYYY-MM-DD` civil date for the Afghan date field, from a stored ISO date. */
export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

/**
 * `commercials`: "required" for new contracts, "optional" when price and terms
 * may be added later (both or neither), "skip" when they are locked or hidden.
 * `requireScope` makes video count and both dates mandatory.
 */
export function validateContractScope(
  input: ContractScopeInput,
  {
    commercials,
    requireScope,
  }: { commercials: "required" | "optional" | "skip"; requireScope: boolean },
): string | null {
  const commercialsEntered = Boolean(input.agreedPrice.trim() || input.agreedTerms.trim());
  if (commercials === "required" || (commercials === "optional" && commercialsEntered)) {
    const price = parseNumberInput(input.agreedPrice);
    if (price == null || Number.isNaN(price) || price <= 0) {
      return "قیمت مجموعی پروژه الزامی و باید بیشتر از صفر باشد.";
    }
    if (!input.agreedTerms.trim()) {
      return "شرایط توافق‌شده الزامی است.";
    }
  }
  const videos = parseNumberInput(input.videoCount);
  if (videos == null ? requireScope : !Number.isInteger(videos) || videos < 1 || videos > 1000) {
    return "تعداد ویدیو الزامی و باید عدد صحیح بین ۱ تا ۱۰۰۰ باشد.";
  }
  const posters = parseNumberInput(input.posterCount);
  if (posters != null && (!Number.isInteger(posters) || posters < 0 || posters > 1000)) {
    return "تعداد پوستر باید عدد صحیح بین ۰ تا ۱۰۰۰ باشد.";
  }
  if (requireScope && !input.startDate) return "تاریخ شروع قرارداد الزامی است.";
  if (requireScope && !input.endDate) return "تاریخ ختم قرارداد الزامی است.";
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    return CONTRACT_PERIOD_MESSAGE;
  }
  return null;
}
