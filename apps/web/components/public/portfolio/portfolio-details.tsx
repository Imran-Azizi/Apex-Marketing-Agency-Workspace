"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Check, ChevronLeft, Share2, Tag } from "lucide-react";
import { VideoPlayer } from "@/components/media/video-player";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { portfolioPublicStreamUrl } from "@/lib/media";
import type { PublicPortfolioDetail } from "@/lib/portfolio";
import { cn, formatDate } from "@/lib/utils";
import { PortfolioRelated } from "./portfolio-related";

export function PortfolioDetails({ item }: { item: PublicPortfolioDetail }) {
  const [copied, setCopied] = useState(false);
  const extraCategories = (item.categories || []).filter(
    (category) => category.id !== item.category?.id,
  );

  async function share() {
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: item.title,
          text: item.description || item.title,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("پیوند نمونه‌کار کپی شد");
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      toast.error("اشتراک‌گذاری در این مرورگر ممکن نشد");
    }
  }

  return (
    <div dir="rtl" className="overflow-x-hidden">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <nav
          aria-label="مسیر صفحه"
          className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground sm:mb-8"
        >
          <Link
            href="/"
            className="rounded-md transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            خانه
          </Link>
          <ChevronLeft className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
          <Link
            href="/#portfolio"
            className="rounded-md transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            نمونه های کاری
          </Link>
          <ChevronLeft className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
          <span className="line-clamp-1 max-w-[min(100%,18rem)] text-foreground sm:max-w-md">
            {item.title}
          </span>
        </nav>

        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
          <VideoPlayer
            src={portfolioPublicStreamUrl(item.id)}
            poster={item.thumbnailUrl || undefined}
            title={item.title}
            className="rounded-none"
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-10">
          <div className="min-w-0">
            {item.category ? (
              <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-brand">
                <Tag className="h-3.5 w-3.5" aria-hidden />
                {item.category.name}
              </p>
            ) : null}
            <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-[2rem]">
              {item.title}
            </h1>
            {item.description ? (
              <p className="mt-4 max-w-3xl text-pretty text-sm leading-8 text-muted-foreground sm:text-base sm:leading-8">
                {item.description}
              </p>
            ) : null}

            <dl className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {item.publishedAt ? (
                <div className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" aria-hidden />
                  <dt className="sr-only">تاریخ انتشار</dt>
                  <dd>{formatDate(item.publishedAt)}</dd>
                </div>
              ) : null}
            </dl>
            {extraCategories.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {extraCategories.map((category) => (
                  <Badge key={category.id} variant="outline">
                    {category.name}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => void share()}
            >
              {copied ? (
                <Check className={cn("h-4 w-4")} aria-hidden />
              ) : (
                <Share2 className="h-4 w-4" aria-hidden />
              )}
              {copied ? "کپی شد" : "اشتراک‌گذاری"}
            </Button>
            <Button variant="brand" className="rounded-full" asChild>
              <Link href="/#portfolio">بازگشت به نمونه های کاری</Link>
            </Button>
          </div>
        </div>

        <div className="mt-12 sm:mt-16">
          <PortfolioRelated
            items={item.related || []}
            categoryName={item.category?.name}
          />
        </div>
      </div>
    </div>
  );
}
