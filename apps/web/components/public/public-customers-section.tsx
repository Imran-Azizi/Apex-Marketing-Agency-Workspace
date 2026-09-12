"use client";

import { Handshake } from "lucide-react";
import type { ShowcaseCustomer } from "@/lib/customers";
import { PublicSection } from "@/components/public/public-section";
import { CustomerCarousel } from "@/components/public/customers/customer-carousel";

export function PublicCustomersSection({
  initialCustomers,
  description,
}: {
  initialCustomers?: ShowcaseCustomer[] | null;
  description?: string | null;
}) {
  const customers = initialCustomers || [];

  return (
    <PublicSection
      id="customers"
      eyebrow="همکاری‌ها"
      title="مشتریان ما"
      description={description || undefined}
      tone="muted"
    >
      {customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-card/50 px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/25 bg-brand/10">
            <Handshake className="h-7 w-7 text-brand" aria-hidden />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            هنوز مشتری‌ای ثبت نشده است
          </h3>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">
            معرفی همکاران و برندهایی که با اپیکس کار کرده‌اند به‌زودی در این بخش
            قرار می‌گیرد.
          </p>
        </div>
      ) : (
        <CustomerCarousel customers={customers} />
      )}
    </PublicSection>
  );
}
