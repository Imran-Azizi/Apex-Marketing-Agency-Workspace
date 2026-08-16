"use client";

import { ArrowLeft, MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scrollToSection } from "@/components/public/use-active-section";
import { cn } from "@/lib/utils";

const HERO_IMAGE_SRC = "/hero_section_images/hero%20image.jpg";

export function PublicHero({ whatsappUrl }: { whatsappUrl?: string }) {
  return (
    <section
      id="home"
      className="relative isolate scroll-mt-20 bg-background text-foreground"
      aria-labelledby="hero-heading"
    >
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="hero-orb absolute -top-28 end-[-12%] h-[26rem] w-[26rem] rounded-full bg-brand/[0.14] blur-3xl dark:bg-brand/[0.12]" />
          <div className="absolute inset-0 bg-gradient-to-b from-brand/[0.05] via-transparent to-transparent dark:from-brand/[0.06]" />
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:gap-12 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14 lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="hero-enter inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-[13px] font-medium text-brand">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              آژانس هوشمند بازاریابی اپیکس
            </p>

            <h1
              id="hero-heading"
              className="hero-enter mt-6 text-balance text-3xl font-bold leading-[1.25] tracking-tight text-foreground sm:text-4xl lg:text-[2.75rem] lg:leading-[1.22]"
              style={{ ["--hero-delay" as string]: "80ms" }}
            >
              ایده‌ها را به{" "}
              <span className="text-brand">محتوای سینمایی</span> تبدیل می‌کنیم
            </h1>

            <p
              className="hero-enter mt-5 max-w-lg text-pretty text-sm leading-8 text-muted-foreground sm:text-base sm:leading-8"
              style={{ ["--hero-delay" as string]: "140ms" }}
            >
              اپیکس یک آژانس تولید محتوا و ویدیو تبلیغاتی است — از سناریو و روایت
              تا تدوین نهایی، با استاندارد حرفه‌ای و فرآیند شفاف برای برندها.
            </p>

            <div
              className="hero-enter mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center"
              style={{ ["--hero-delay" as string]: "200ms" }}
            >
              {whatsappUrl ? (
                <Button
                  variant="brand"
                  size="lg"
                  className={cn(
                    "h-12 w-full rounded-xl px-6 text-base shadow-lg shadow-brand/20",
                    "sm:w-auto sm:min-w-[12.5rem]",
                  )}
                  asChild
                >
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="h-5 w-5" />
                    شروع پروژه
                  </a>
                </Button>
              ) : (
                <Button
                  variant="brand"
                  size="lg"
                  className="h-12 w-full rounded-xl px-6 text-base sm:w-auto sm:min-w-[12.5rem]"
                  disabled
                >
                  <MessageCircle className="h-5 w-5" />
                  شروع پروژه
                </Button>
              )}
              <Button
                variant="outline"
                size="lg"
                className="group h-12 w-full rounded-xl border-border bg-card px-6 text-base text-foreground hover:bg-accent hover:text-accent-foreground dark:bg-card/60 sm:w-auto sm:min-w-[12.5rem]"
                onClick={() => scrollToSection("portfolio")}
              >
                مشاهده آثار
                <ArrowLeft className="h-4 w-4 transition-transform duration-300 motion-safe:group-hover:-translate-x-0.5" />
              </Button>
            </div>
          </div>

          <HeroImage />
        </div>
      </div>
    </section>
  );
}

function HeroImage() {
  return (
    <div
      className="hero-enter relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none"
      style={{ ["--hero-delay" as string]: "160ms" }}
    >
      <div
        className="pointer-events-none absolute -inset-6 hidden rounded-[2.25rem] bg-brand/15 blur-3xl dark:bg-brand/20 lg:block"
        aria-hidden
      />
      <figure
        className={cn(
          "relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-[#0a0e16]",
          "shadow-[0_24px_64px_-28px_hsl(var(--foreground)/0.28)]",
          "dark:border-brand/20 dark:shadow-[0_28px_80px_-32px_hsl(0_0%_0%/0.65)]",
        )}
      >
        <img
          src={HERO_IMAGE_SRC}
          alt="رشد کسب‌وکار با بازاریابی دیجیتال — اپیکس"
          width={900}
          height={1200}
          decoding="async"
          fetchPriority="high"
          className="mx-auto block h-auto w-auto max-h-[min(34rem,68vh)] max-w-full object-contain object-center lg:max-h-[min(38rem,72vh)]"
        />
      </figure>
    </div>
  );
}
