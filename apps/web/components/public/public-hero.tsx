"use client";

import {
  ArrowLeft,
  Clapperboard,
  Film,
  LayoutDashboard,
  MessageCircle,
  Mic2,
  Play,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { scrollToSection } from "@/components/public/use-active-section";
import { cn } from "@/lib/utils";

const TRUST_CHIPS = [
  { icon: ShieldCheck, label: "کیفیت سازمانی" },
  { icon: Clapperboard, label: "تولید سینمایی" },
  { icon: LayoutDashboard, label: "پورتال شفاف" },
] as const;

const PROOF_POINTS = [
  { icon: Clapperboard, label: "از ایده تا تحویل" },
  { icon: Mic2, label: "روایت و تدوین" },
  { icon: LayoutDashboard, label: "پورتال مشتری" },
  { icon: Timer, label: "زمان‌بندی دقیق" },
] as const;

export function PublicHero({ whatsappUrl }: { whatsappUrl?: string }) {
  return (
    <section
      id="home"
      className="relative isolate scroll-mt-20 text-foreground"
      aria-labelledby="hero-heading"
    >
      <div className="relative overflow-hidden">
        <HeroAtmosphere />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-12 pt-14 sm:gap-14 sm:px-6 sm:pb-14 sm:pt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16 lg:px-8 lg:pb-16 lg:pt-20">
          {/* Copy — first on mobile */}
          <div className="relative z-10 flex flex-col items-start">
            <div
              className="hero-enter inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/[0.08] px-3.5 py-1.5 text-[13px] font-medium text-brand shadow-sm shadow-brand/5 dark:border-brand/35 dark:bg-brand/10 dark:shadow-none"
              style={{ ["--hero-delay" as string]: "0ms" }}
            >
              <span className="relative flex h-2 w-2">
                <span className="hero-pulse absolute inset-0 rounded-full bg-brand/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
              </span>
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              آژانس هوشمند بازاریابی اپیکس
            </div>

            <h1
              id="hero-heading"
              className="hero-enter mt-6 max-w-[18ch] text-balance font-bold tracking-tight text-foreground"
              style={{
                ["--hero-delay" as string]: "80ms",
                fontSize: "clamp(1.875rem, 1.35rem + 2.2vw, 3.15rem)",
                lineHeight: 1.22,
              }}
            >
              ایده‌ها را به{" "}
              <span className="relative inline-block text-brand">
                محتوای سینمایی
                <span
                  className="absolute inset-x-0 -bottom-1 h-px bg-gradient-to-l from-transparent via-brand/50 to-transparent"
                  aria-hidden
                />
              </span>{" "}
              تبدیل می‌کنیم
            </h1>

            <p
              className="hero-enter mt-5 max-w-md text-pretty text-[0.9375rem] leading-8 text-muted-foreground sm:text-base sm:leading-8"
              style={{ ["--hero-delay" as string]: "160ms" }}
            >
              اپیکس یک آژانس تولید محتوا و ویدیو تبلیغاتی است — از سناریو و روایت
              تا تدوین نهایی، با استاندارد حرفه‌ای و فرآیند شفاف برای برندها.
            </p>

            <div
              className="hero-enter mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center"
              style={{ ["--hero-delay" as string]: "240ms" }}
            >
              {whatsappUrl ? (
                <Button
                  variant="brand"
                  size="lg"
                  className={cn(
                    "h-12 w-full rounded-xl px-7 text-base shadow-md shadow-brand/20",
                    "transition-[transform,box-shadow] duration-300",
                    "motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-lg motion-safe:hover:shadow-brand/30",
                    "dark:shadow-brand/15 dark:motion-safe:hover:shadow-brand/25",
                    "sm:w-auto sm:min-w-[11.5rem]",
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
                  className="h-12 w-full rounded-xl px-7 text-base sm:w-auto sm:min-w-[11.5rem]"
                  disabled
                >
                  <MessageCircle className="h-5 w-5" />
                  شروع پروژه
                </Button>
              )}
              <Button
                variant="outline"
                size="lg"
                className={cn(
                  "group h-12 w-full rounded-xl border-border/80 bg-card/80 px-7 text-base text-foreground backdrop-blur-sm",
                  "shadow-sm transition-[transform,background-color,border-color,box-shadow] duration-300",
                  "hover:border-brand/30 hover:bg-card hover:text-foreground",
                  "motion-safe:hover:-translate-y-0.5",
                  "dark:bg-card/50 dark:hover:bg-card/80",
                  "sm:w-auto sm:min-w-[11.5rem]",
                )}
                onClick={() => scrollToSection("portfolio")}
              >
                مشاهده آثار
                <ArrowLeft className="h-4 w-4 transition-transform duration-300 motion-safe:group-hover:-translate-x-0.5" />
              </Button>
            </div>

            <ul
              className="hero-enter mt-9 flex flex-wrap items-center gap-2.5"
              style={{ ["--hero-delay" as string]: "320ms" }}
              aria-label="مزایای کلیدی"
            >
              {TRUST_CHIPS.map((item) => {
                const Icon = item.icon;
                return (
                  <li
                    key={item.label}
                    className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3.5 py-2 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm dark:border-border/60 dark:bg-card/50"
                  >
                    <Icon
                      className="h-3.5 w-3.5 text-brand"
                      aria-hidden
                    />
                    {item.label}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Creative visual — after copy on mobile */}
          <HeroVisual />
        </div>

        {/* Trust / process strip */}
        <div className="relative border-t border-border/50 bg-card/40 backdrop-blur-sm dark:bg-card/20">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-border/50 sm:grid-cols-4">
            {PROOF_POINTS.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="hero-enter flex items-center gap-3 bg-background/60 px-4 py-4 backdrop-blur-sm dark:bg-background/40 sm:px-6 sm:py-5"
                  style={{
                    ["--hero-delay" as string]: `${380 + i * 60}ms`,
                  }}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand/30 bg-brand/10 text-brand dark:border-brand/40 dark:bg-brand/15">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <p className="text-sm font-medium leading-6 text-foreground">
                    {item.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroAtmosphere() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Soft brand orbs — logical positioning for RTL */}
      <div className="hero-orb absolute -top-32 end-[-18%] h-[28rem] w-[28rem] rounded-full bg-brand/[0.16] blur-3xl dark:bg-brand/[0.14]" />
      <div className="hero-orb-alt absolute bottom-[-18%] start-[-14%] h-[22rem] w-[22rem] rounded-full bg-brand/[0.09] blur-3xl dark:bg-brand/[0.11]" />
      <div className="absolute inset-0 bg-gradient-to-b from-brand/[0.05] via-transparent to-transparent dark:from-brand/[0.06]" />
      {/* Soft vignette so dots stay secondary near content */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,hsl(var(--background)/0.35)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_30%,hsl(var(--background)/0.45)_100%)]" />
    </div>
  );
}

function HeroVisual() {
  return (
    <div
      className="hero-enter relative mx-auto w-full max-w-md overflow-x-clip sm:max-w-lg lg:mx-0 lg:max-w-none"
      style={{ ["--hero-delay" as string]: "180ms" }}
    >
      <div
        className="pointer-events-none absolute -inset-8 -z-10 rounded-[3rem] bg-brand/[0.12] blur-3xl dark:bg-brand/[0.18]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-[12%] -z-10 rounded-full bg-brand/[0.08] blur-2xl dark:bg-brand/15"
        aria-hidden
      />

      <div className="relative aspect-[4/5] w-full sm:aspect-[5/6] lg:aspect-[4/5] xl:aspect-[5/6]">
        {/* Rear depth plate */}
        <div
          className="absolute inset-[10%_8%_8%_14%] rotate-[-3deg] rounded-[1.75rem] border border-border/40 bg-gradient-to-br from-card/40 via-muted/30 to-brand/5 dark:border-border/30 dark:from-card/30 dark:via-background/40 dark:to-brand/10"
          aria-hidden
        />
        <div
          className="absolute inset-[12%_12%_10%_10%] rotate-[2.5deg] rounded-[1.6rem] border border-brand/15 bg-card/30 backdrop-blur-[2px] dark:border-brand/20 dark:bg-card/20"
          aria-hidden
        />

        {/* Primary cinematic stage */}
      <div
        className={cn(
            "group/stage absolute inset-[4%] z-10 overflow-hidden rounded-[1.65rem]",
            "border border-border/60 bg-card",
            "shadow-[0_32px_72px_-28px_hsl(var(--foreground)/0.28),0_0_0_1px_hsl(var(--brand)/0.06)]",
            "dark:border-brand/25 dark:bg-[#141a22]",
            "dark:shadow-[0_36px_90px_-30px_hsl(0_0%_0%/0.75),0_0_0_1px_hsl(var(--brand)/0.12)]",
          )}
        >
          <CinemaStage />

          {/* Top chrome */}
          <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-medium text-white/90 backdrop-blur-md dark:border-white/10">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              APEX · Cinematic
            </div>
            <div className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] text-white/75 backdrop-blur-md sm:inline-flex">
              <Clapperboard className="h-3 w-3 text-brand" />
              4K · ProRes
            </div>
          </div>

          {/* Editor timeline */}
          <div className="absolute inset-x-0 bottom-0 z-20 border-t border-white/10 bg-gradient-to-t from-black/55 via-black/35 to-transparent px-4 pb-3.5 pt-8 backdrop-blur-[6px] dark:from-black/70">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-md shadow-brand/30">
                <Play className="h-3.5 w-3.5 fill-current ps-px" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="relative h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div className="hero-timeline absolute inset-y-0 start-0 w-[62%] rounded-full bg-brand" />
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-white/65">
                  <span>۰۰:۴۲</span>
                  <span className="hidden text-white/40 sm:inline">
                    کمپین برند · نسخه نهایی
                  </span>
                  <span>۰۱:۱۸</span>
                </div>
              </div>
              <Film className="h-3.5 w-3.5 text-white/50" aria-hidden />
            </div>
          </div>
        </div>

        {/* Storyboard — supporting layer */}
        <div
          className={cn(
            "hero-float absolute end-0 top-[5%] z-20 hidden w-[46%] max-w-[13rem] rounded-2xl border border-border/60 bg-card/90 p-2.5 shadow-xl backdrop-blur-xl md:block",
            "transition-transform duration-500 motion-safe:hover:-translate-y-1",
            "dark:border-border/40 dark:bg-card/70 dark:shadow-black/50",
          )}
          aria-hidden
        >
          <div className="mb-2 flex items-center justify-between px-0.5">
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground">
              استوری‌بورد
            </p>
            <span className="text-[9px] text-brand">۳ شات</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <StoryboardFrame tone="wide" active={false} />
            <StoryboardFrame tone="focus" active />
            <StoryboardFrame tone="close" active={false} />
          </div>
        </div>

        {/* Analytics cue */}
        <div
          className={cn(
            "hero-float-alt absolute end-[4%] bottom-[28%] z-20 hidden w-[7.75rem] rounded-2xl border border-border/60 bg-card/92 p-3 shadow-lg backdrop-blur-xl lg:block",
            "dark:border-border/40 dark:bg-card/75 dark:shadow-black/45",
          )}
          aria-hidden
        >
          <p className="text-[10px] font-medium text-muted-foreground">تعامل</p>
          <p className="mt-0.5 text-lg font-bold tracking-tight text-foreground">
            +۱۸۴٪
          </p>
          <div className="mt-2 flex h-8 items-end gap-1">
            {[28, 42, 36, 58, 48, 72, 64, 88].map((h, i) => (
              <span
                key={i}
                className="flex-1 rounded-sm bg-brand/25 dark:bg-brand/30"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        {/* Narration card */}
        <div
          className={cn(
            "hero-float-alt absolute bottom-[18%] start-0 z-20 hidden w-[48%] max-w-[12rem] rounded-2xl border border-border/60 bg-card/95 p-3 shadow-xl backdrop-blur-xl sm:block sm:start-[-1%]",
            "dark:border-border/40 dark:bg-card/80 dark:shadow-black/45",
          )}
          aria-hidden
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/12 text-brand ring-1 ring-brand/20">
              <Mic2 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-foreground">
                روایت حرفه‌ای
              </p>
              <p className="text-[10px] text-muted-foreground">لایه صدا فعال</p>
            </div>
          </div>
          <div className="mt-3 flex h-7 items-end gap-[3px] px-0.5">
            {WAVEFORM.map((h, i) => (
              <span
                key={i}
                className="hero-wave flex-1 rounded-full bg-gradient-to-t from-brand/40 to-brand/80 dark:from-brand/30 dark:to-brand/70"
                style={{
                  height: `${h}%`,
                  animationDelay: `${i * 70}ms`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Live status */}
        <div
          className={cn(
            "hero-float absolute start-[5%] top-[9%] z-20 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/95 px-3 py-1.5 text-[11px] font-medium text-foreground shadow-lg backdrop-blur-xl",
            "dark:border-border/40 dark:bg-card/80",
          )}
          aria-hidden
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="hero-pulse absolute inset-0 rounded-full bg-success/70" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-success" />
          </span>
          در حال تولید
        </div>

        {/* Portfolio CTA */}
          <button
            type="button"
            onClick={() => scrollToSection("portfolio")}
            aria-label="مشاهده نمونه‌کارها و روایت‌ها"
          className={cn(
            "absolute end-[8%] top-[52%] z-30 inline-flex items-center gap-2.5 rounded-full border border-border/70 bg-card/95 pe-4 ps-1.5 py-1.5 text-start shadow-xl backdrop-blur-xl sm:top-auto sm:bottom-[24%] sm:end-[8%]",
            "transition-[transform,box-shadow,background-color,border-color] duration-300",
            "hover:border-brand/30 hover:bg-card motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-2xl",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
            "dark:border-border/50 dark:bg-background/90 dark:hover:bg-background",
          )}
        >
          <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-md shadow-brand/30">
            <span className="hero-pulse absolute inset-0 rounded-full bg-brand/40" />
            <Play className="relative h-3.5 w-3.5 fill-current ps-0.5" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">
              تماشای آثار
              </span>
            <span className="block text-[10px] text-muted-foreground">
              نمونه‌کارهای منتخب
            </span>
            </span>
          </button>
      </div>
    </div>
  );
}

const WAVEFORM = [35, 55, 40, 70, 45, 85, 50, 65, 38, 75, 48, 60, 42, 68] as const;

function StoryboardFrame({
  tone,
  active,
}: {
  tone: "wide" | "focus" | "close";
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative aspect-video overflow-hidden rounded-lg border border-border/50",
        active && "ring-1 ring-brand/60 ring-offset-1 ring-offset-card",
        !active && "opacity-85",
      )}
    >
      <div
        className={cn(
          "absolute inset-0",
          tone === "wide" &&
            "bg-[radial-gradient(ellipse_at_30%_40%,hsl(var(--brand)/0.35),transparent_55%),linear-gradient(145deg,hsl(var(--muted)),hsl(var(--card)))]",
          tone === "focus" &&
            "bg-[radial-gradient(circle_at_50%_45%,hsl(var(--brand)/0.55),transparent_50%),linear-gradient(160deg,hsl(var(--foreground)/0.08),hsl(var(--muted)))]",
          tone === "close" &&
            "bg-[linear-gradient(210deg,hsl(var(--brand)/0.2),hsl(var(--muted))_40%,hsl(var(--card)))]",
        )}
      />
      {tone === "wide" ? (
        <span className="absolute inset-x-[18%] bottom-[22%] h-[28%] rounded-sm bg-foreground/10 dark:bg-white/10" />
      ) : null}
      {tone === "focus" ? (
        <span className="absolute start-1/2 top-[42%] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand shadow-sm shadow-brand/40" />
      ) : null}
      {tone === "close" ? (
        <>
          <span className="absolute end-[20%] top-[28%] h-4 w-4 rounded-full bg-brand/50" />
          <span className="absolute inset-x-[22%] bottom-[20%] h-1 rounded-full bg-foreground/15" />
        </>
      ) : null}
    </div>
  );
}

function CinemaStage() {
  return (
    <div className="absolute inset-0" aria-hidden>
      {/* Atmospheric base — cinematic grade */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_32%,hsl(var(--brand)/0.28),transparent_52%),linear-gradient(168deg,#ebe6dc_0%,hsl(var(--muted))_38%,#d9d2c6_100%)] dark:bg-[radial-gradient(ellipse_at_50%_30%,hsl(var(--brand)/0.32),transparent_54%),linear-gradient(168deg,#1a2230_0%,#121820_45%,#0d1118_100%)]" />

      {/* Soft volumetric light */}
      <div className="absolute inset-x-[8%] top-[-10%] h-[55%] rounded-full bg-brand/20 blur-3xl dark:bg-brand/25" />
      <div className="absolute bottom-[18%] start-[10%] h-40 w-40 rounded-full bg-brand/10 blur-3xl dark:bg-brand/15" />

      {/* Letterbox bars */}
      <div className="absolute inset-x-0 top-0 h-[7%] bg-gradient-to-b from-black/35 to-transparent dark:from-black/55" />
      <div className="absolute inset-x-0 bottom-0 h-[28%] bg-gradient-to-t from-black/50 via-black/15 to-transparent dark:from-black/70" />

      {/* Light sweep */}
      <div className="hero-sweep pointer-events-none absolute inset-0 opacity-35 dark:opacity-25" />

      {/* Film grain */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay dark:opacity-[0.12]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Aperture / lens focal system */}
      <svg
        viewBox="0 0 400 480"
        className="absolute inset-0 h-full w-full"
        fill="none"
      >
        <defs>
          <radialGradient id="apex-lens-glow" cx="50%" cy="38%" r="40%">
            <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity="0.35" />
            <stop offset="55%" stopColor="hsl(var(--brand))" stopOpacity="0.06" />
            <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="200" cy="175" rx="140" ry="120" fill="url(#apex-lens-glow)" />

        {/* Outer dashed orbit */}
        <circle
          className="hero-orbit"
          cx="200"
          cy="175"
          r="108"
          stroke="hsl(var(--brand))"
          strokeOpacity="0.22"
          strokeDasharray="3 10"
          strokeWidth="1"
        />
        <circle
          cx="200"
          cy="175"
          r="86"
          stroke="hsl(var(--brand))"
          strokeOpacity="0.28"
          strokeWidth="1.25"
        />
        <circle
          cx="200"
          cy="175"
          r="62"
          stroke="hsl(var(--brand))"
          strokeOpacity="0.42"
          strokeWidth="1.5"
        />
        <circle
          cx="200"
          cy="175"
          r="38"
          stroke="hsl(var(--brand))"
          strokeOpacity="0.55"
          strokeWidth="1.25"
        />

        {/* Core */}
        <circle cx="200" cy="175" r="18" fill="hsl(var(--brand))" fillOpacity="0.95" />
        <circle cx="200" cy="175" r="10" fill="hsl(var(--brand-foreground))" fillOpacity="0.12" />

        {/* Subtle geometric accents */}
        <path
          d="M200 55v22M200 273v22M95 175h22M283 175h22"
          stroke="hsl(var(--brand))"
          strokeOpacity="0.28"
          strokeWidth="1"
          strokeLinecap="round"
        />

        {/* Mini horizon line — cinematic composition cue */}
        <path
          d="M70 290c40-18 90-28 130-28s90 10 130 28"
          stroke="hsl(var(--brand))"
          strokeOpacity="0.18"
          strokeWidth="1.25"
        />
        <rect
          x="118"
          y="302"
          width="164"
          height="10"
          rx="5"
          fill="hsl(var(--brand))"
          fillOpacity="0.12"
        />
        <rect
          x="148"
          y="320"
          width="104"
          height="6"
          rx="3"
          fill="hsl(var(--foreground))"
          fillOpacity="0.08"
        />
      </svg>

      {/* Frame corners */}
      <span className="absolute start-4 top-12 h-8 w-8 border-s-2 border-t-2 border-brand/50 sm:start-5 sm:top-14" />
      <span className="absolute end-4 top-12 h-8 w-8 border-e-2 border-t-2 border-brand/50 sm:end-5 sm:top-14" />
      <span className="absolute bottom-[30%] start-4 h-8 w-8 border-b-2 border-s-2 border-brand/35 sm:start-5" />
      <span className="absolute bottom-[30%] end-4 h-8 w-8 border-b-2 border-e-2 border-brand/35 sm:end-5" />
    </div>
  );
}
