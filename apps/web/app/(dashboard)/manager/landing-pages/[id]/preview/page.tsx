"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { useState } from "react";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/loading/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { LandingPageRenderer } from "@/components/landing/landing-page-renderer";
import { cn } from "@/lib/utils";
import type { LandingPage } from "@/lib/landing-pages";
import type { PublicContactInfo } from "@/lib/contact";

export default function LandingPagePreviewPage() {
  const params = useParams<{ id: string }>();
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
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
  const frame =
    device === "mobile" ? "max-w-[390px]" : device === "tablet" ? "max-w-[768px]" : "max-w-5xl";

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold">پیش‌نمایش: {page.title}</h1>
          <p className="text-xs text-muted-foreground">
            این پیش‌نمایش صفحه را منتشر نمی‌کند.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5">
            <Button size="icon" variant={device === "desktop" ? "secondary" : "ghost"} className="h-8 w-8" onClick={() => setDevice("desktop")}>
              <Monitor className="h-4 w-4" />
            </Button>
            <Button size="icon" variant={device === "tablet" ? "secondary" : "ghost"} className="h-8 w-8" onClick={() => setDevice("tablet")}>
              <Tablet className="h-4 w-4" />
            </Button>
            <Button size="icon" variant={device === "mobile" ? "secondary" : "ghost"} className="h-8 w-8" onClick={() => setDevice("mobile")}>
              <Smartphone className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/manager/landing-pages/${page.id}`}>بازگشت به سازنده</Link>
          </Button>
        </div>
      </div>
      <div className={cn("mx-auto overflow-hidden rounded-2xl border bg-background shadow-sm", frame)}>
        <LandingPageRenderer
          content={page.content}
          contact={contactQ.data}
          showForm
        />
      </div>
    </div>
  );
}
