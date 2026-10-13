import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { CompanyProfile } from "@/lib/contract-workspace";

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-sm leading-7">{children || "—"}</div>
    </div>
  );
}

export function CompanyProfileView({ company }: { company: CompanyProfile }) {
  return (
    <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
      <Field label="نام شرکت" wide>
        <span className="text-base font-semibold">{company.companyName}</span>
      </Field>
      <Field label="معرفی شرکت" wide>
        {company.companyIntro ? (
          <p className="whitespace-pre-wrap">{company.companyIntro}</p>
        ) : null}
      </Field>
      <Field label="ویژگی‌ها و مزایا" wide>
        {company.features.length ? (
          <div className="flex flex-wrap gap-1.5">
            {company.features.map((feature) => (
              <Badge key={feature} variant="secondary" className="font-medium">
                {feature}
              </Badge>
            ))}
          </div>
        ) : null}
      </Field>
      <Field label="مخاطب هدف">{company.audience}</Field>
      <Field label="هدف تبلیغ">{company.goal}</Field>
      <Field label="پیام اصلی تبلیغ">{company.mainMessage}</Field>
      <Field label="دعوت به اقدام (CTA)">{company.cta}</Field>
      <Field label="آدرس دقیق شرکت" wide>
        {company.address}
      </Field>
      <Field label="شماره‌های تماس شرکت" wide>
        {company.contactNumbers.length ? (
          <div className="flex flex-wrap gap-2">
            {company.contactNumbers.map((number) => (
              <a
                key={number}
                href={`tel:${number.replace(/[^\d+]/g, "")}`}
                dir="ltr"
                className="rounded-lg border border-border/70 bg-muted/30 px-2.5 py-1 font-medium tabular-nums transition-colors hover:border-brand/40 hover:text-brand"
              >
                {number}
              </a>
            ))}
          </div>
        ) : null}
      </Field>
    </div>
  );
}
