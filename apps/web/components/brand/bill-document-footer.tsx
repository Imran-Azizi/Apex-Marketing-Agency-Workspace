"use client";

import { cn } from "@/lib/utils";

type BillDocumentFooterProps = {
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  className?: string;
};

export function BillDocumentFooter({
  phone,
  email,
  website,
  className,
}: BillDocumentFooterProps) {
  const contacts = [phone, email, website]
    .map((v) => String(v || "").trim())
    .filter(Boolean);

  return (
    <footer className={cn("px-5 pb-5 pt-1 text-center", className)}>
      <div
        aria-hidden
        className="mx-auto mb-3 h-px max-w-[72%] bg-gradient-to-l from-transparent via-[#d4af37] to-transparent"
      />
      <p className="text-[11px] font-semibold text-slate-500">
        با سپاس از اعتماد شما
      </p>
      <p className="mt-1 text-[9.5px] font-extrabold tracking-[0.14em] text-[#1e3a5f]">
        APEX SMART MARKETING
      </p>
      {contacts.length ? (
        <p
          dir="ltr"
          className="mt-1.5 text-[9px] font-semibold tabular-nums text-slate-400 [unicode-bidi:isolate]"
        >
          {contacts.join("  ·  ")}
        </p>
      ) : null}
    </footer>
  );
}
