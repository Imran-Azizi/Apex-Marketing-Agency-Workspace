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
    <div className="flex min-h-[calc(100vh-6rem)] flex-col" dir="rtl">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold sm:text-lg">
              پیش‌نمایش: {page.title}
            </h1>
            <p className="text-[11px] text-muted-foreground">
              این پیش‌نمایش صفحه را منتشر نمی‌کند.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link href={`/manager/landing-pages/${page.id}`}>
              بازگشت به سازنده
            </Link>
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto bg-background">
        <LandingPageRenderer
          content={page.content}
          contact={contactQ.data}
          showForm
        />
      </div>
    </div>
  );
}
