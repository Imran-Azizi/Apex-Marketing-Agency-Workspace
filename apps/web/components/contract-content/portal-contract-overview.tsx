import type { ReactNode } from "react";
import { FileText, UserRound } from "lucide-react";
import type { PortalContractDetail } from "@/lib/contract-workspace";
import { formatCount } from "@/lib/contract-project";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

function OverviewCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof FileText;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-base font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function InfoRow({
  label,
  value,
  ltr = false,
}: {
  label: string;
  value: ReactNode;
  ltr?: boolean;
}) {
  const empty = value == null || value === "";
  return (
    <div className="flex min-w-0 items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd
        dir={ltr && !empty ? "ltr" : undefined}
        className={cn(
          "min-w-0 break-words text-sm font-medium [unicode-bidi:isolate]",
          ltr ? "text-left" : "text-end",
          empty && "text-muted-foreground",
        )}
      >
        {empty ? "—" : value}
      </dd>
    </div>
  );
}

function MoneyTile({
  label,
  amount,
  tone = "default",
}: {
  label: string;
  amount: number;
  tone?: "default" | "brand" | "success";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        tone === "brand" && "border-brand/25 bg-brand/5",
        tone === "success" && "border-emerald-500/25 bg-emerald-500/5",
        tone === "default" && "border-border/80 bg-muted/20",
      )}
    >
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p
        dir="ltr"
        className={cn(
          "mt-1 text-right text-base font-black tabular-nums [unicode-bidi:isolate]",
          tone === "brand" && "text-brand",
          tone === "success" && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {formatCurrency(amount)}
      </p>
    </div>
  );
}

export function PortalContractOverview({ contract }: { contract: PortalContractDetail }) {
  const { customer, commercials } = contract;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <OverviewCard title="جزئیات قرارداد" icon={FileText}>
        {commercials ? (
          <div className="grid gap-2 sm:grid-cols-3">
            <MoneyTile label="قیمت مجموعی" amount={commercials.price} />
            <MoneyTile label="پرداخت‌شده" amount={commercials.received} tone="success" />
            <MoneyTile label="باقی مانده" amount={commercials.remaining} tone="brand" />
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            قیمت و شرایط قرارداد پس از بررسی توسط تیم اپکس ثبت می‌شود.
          </p>
        )}
        <dl className="divide-y divide-border/60">
          <InfoRow
            label="تاریخ شروع قرارداد"
            value={contract.startDate ? formatDate(contract.startDate) : null}
          />
          <InfoRow
            label="تاریخ ختم قرارداد"
            value={contract.endDate ? formatDate(contract.endDate) : null}
          />
          <InfoRow
            label="تعداد ویدیو"
            value={contract.videoCount != null ? formatCount(contract.videoCount) : null}
          />
          <InfoRow
            label="تعداد پوستر"
            value={contract.posterCount != null ? formatCount(contract.posterCount) : null}
          />
        </dl>
        {commercials?.agreedTerms ? (
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">شرایط توافق شده</p>
            <p className="whitespace-pre-wrap rounded-xl border border-border/80 bg-muted/20 px-4 py-3 text-sm leading-7">
              {commercials.agreedTerms}
            </p>
          </div>
        ) : null}
      </OverviewCard>

      <OverviewCard title="اطلاعات مشتری" icon={UserRound}>
        <dl className="divide-y divide-border/60">
          <InfoRow label="نام مشتری" value={customer.personName} />
          <InfoRow label="سمت" value={customer.jobTitle} />
          <InfoRow label="نام شرکت" value={customer.companyName} />
          <InfoRow label="تلفن" value={customer.phone} ltr />
          <InfoRow label="واتساپ" value={customer.whatsapp} ltr />
          <InfoRow label="ایمیل" value={customer.email} ltr />
          <InfoRow label="وب‌سایت" value={customer.website} ltr />
          <InfoRow label="آدرس" value={customer.address} />
        </dl>
      </OverviewCard>
    </div>
  );
}
