"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/loading/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { LandingPageRenderer } from "@/components/landing/landing-page-renderer";
import type { LandingPage } from "@/lib/landing-pages";
import type { PublicContactInfo } from "@/lib/contact";

export default function LandingPagePreviewPage() {
  const params = useParams<{ id: string }>();
  const query = useQuery({
    queryKey: ["landing-page", params.id],
    queryFn: () => apiGet<LandingPage>(`/landing-pages/${params.id}`),
    enabled: Boolean(params.id),
  });
  const contactQ = useQuery({
    queryKey: ["public-contact-info"],
    queryFn: () => apiGet<PublicContactInfo>("/public/contact-info"),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  if (query.isLoading) {
    return <Skeleton className="h-[70vh] w-full rounded-2xl" />;
  }
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="پیش‌نمایش در دسترس نیست"
        onRetry={() => query.refetch()}
      />
    );
  }

  const page = query.data;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold">پیش‌نمایش: {page.title}</h1>
          <p className="text-xs text-muted-foreground">
            این پیش‌نمایش صفحه را منتشر نمی‌کند.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/manager/landing-pages/${page.id}`}>
            بازگشت به سازنده
          </Link>
        </Button>
      </div>
      <div className="mx-auto w-full max-w-[1200px] overflow-hidden rounded-2xl border bg-background shadow-sm">
        <LandingPageRenderer
          content={page.content}
          contact={contactQ.data}
          showForm
        />
      </div>
    </div>
  );
}
