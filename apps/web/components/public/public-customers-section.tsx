"use client";

import { useQuery } from "@tanstack/react-query";
import { Handshake } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { ShowcaseCustomer } from "@/lib/customers";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicSection } from "@/components/public/public-section";
import { CustomerCarousel } from "@/components/public/customers/customer-carousel";

export function PublicCustomersSection() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-customers"],
    queryFn: () => apiGet<ShowcaseCustomer[]>("/public/customers"),
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  const customers = data || [];

  return (
    <PublicSection
      id="customers"
      eyebrow="همکاری‌ها"
      title="مشتریان ما"
      description="برندها و سازمان‌هایی که به اپیکس اعتماد کرده‌اند و در ساخت روایت تصویری خود با ما همکاری داشته‌اند."
      tone="muted"
    >
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col items-center rounded-2xl border border-border/70 bg-card px-3.5 pb-3.5 pt-4"
            >
              <Skeleton className="size-20 rounded-full" />
              <Skeleton className="mt-3 h-4 w-2/3" />
              <Skeleton className="mt-1.5 h-3 w-1/2" />
              <Skeleton className="mt-2 h-8 w-full" />
            </div>
          ))}
        </div>
      ) : null}

      {error && !isLoading ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-card/50 px-6 py-16 text-center">
          <h3 className="text-lg font-semibold text-foreground">
            بارگذاری مشتریان ناموفق بود
          </h3>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">
            لطفاً بعداً دوباره تلاش کنید.
          </p>
        </div>
      ) : null}

      {!isLoading && !error && customers.length === 0 ? (
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
      ) : null}

      {!isLoading && !error && customers.length > 0 ? (
        <CustomerCarousel customers={customers} />
      ) : null}
    </PublicSection>
  );
}
