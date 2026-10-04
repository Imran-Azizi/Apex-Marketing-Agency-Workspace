import Link from "next/link";
import { ArrowLeft, ChevronLeft, Clapperboard } from "lucide-react";
import {
  isExternalServiceHref,
  serviceImageSrc,
  serviceTitle,
  type PublicService,
} from "@/lib/services";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CoverImage } from "@/components/media/cover-image";
import { RichTextContent } from "@/components/editor/rich-text-content";

export function ServiceDetails({ service }: { service: PublicService }) {
  const title = serviceTitle(service);
  const imageSrc = serviceImageSrc(service);
  const ctaHref = service.ctaHref?.trim() || "/#contact";
  const ctaLabel = service.ctaLabel?.trim() || "ثبت درخواست";
  const external = isExternalServiceHref(ctaHref);

  return (
    <div dir="rtl" className="overflow-x-hidden">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <nav
          aria-label="مسیر صفحه"
          className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground sm:mb-8"
        >
          <Link
            href="/"
            prefetch={false}
            className="rounded-md transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            خانه
          </Link>
          <ChevronLeft className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
          <Link
            href="/#services"
            prefetch={false}
            className="rounded-md transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            خدمات ما
          </Link>
          <ChevronLeft className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
          <span className="line-clamp-1 max-w-[min(100%,18rem)] text-foreground sm:max-w-md">
            {title}
          </span>
        </nav>

        <article className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm sm:rounded-3xl">
          <div className="relative aspect-[16/9] bg-muted sm:aspect-[21/9]">
            {imageSrc ? (
              <CoverImage
                src={imageSrc}
                alt={title}
                sizes="(max-width: 1024px) 100vw, 72rem"
                quality={80}
                priority
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand/15 via-muted to-background">
                <Clapperboard className="h-12 w-12 text-brand/70 sm:h-14 sm:w-14" />
              </div>
            )}
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/55 via-transparent to-transparent"
              aria-hidden
            />
          </div>

          <div className="space-y-6 p-5 sm:space-y-8 sm:p-8 lg:p-10">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-[2rem]">
                  {title}
                </h1>
                {service.startingPrice ? (
                  <p className="mt-3 text-base font-medium text-brand sm:text-lg">
                    از {formatCurrency(Number(service.startingPrice))}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:pt-1">
                <Button variant="outline" className="rounded-full" asChild>
                  <Link href="/#services" prefetch={false}>
                    بازگشت به خدمات
                  </Link>
                </Button>
                <Button variant="brand" className="rounded-full gap-1.5" asChild>
                  <Link
                    href={ctaHref}
                    prefetch={false}
                    {...(external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                  >
                    {ctaLabel}
                    <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                  </Link>
                </Button>
              </div>
            </header>

            {service.description ? (
              <div className="border-t border-border/60 pt-6 sm:pt-8">
                <RichTextContent
                  value={service.description}
                  className="max-w-3xl text-sm leading-8 sm:max-w-4xl sm:text-base sm:leading-8"
                />
              </div>
            ) : null}
          </div>
        </article>
      </div>
    </div>
  );
}
