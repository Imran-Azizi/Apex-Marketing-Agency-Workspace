"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Instagram,
  Linkedin,
  MessageCircle,
  Send,
  Star,
} from "lucide-react";
import { ResponsiveCoverImage } from "@/components/landing/responsive-cover-image";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { bool, num, str, type LandingElement } from "@/lib/landing-content";
import {
  elementBoxStyle,
  elementVisibilityClass,
} from "@/lib/landing-styles";

const SOCIAL_ICONS: Record<string, typeof Instagram> = {
  instagram: Instagram,
  telegram: Send,
  linkedin: Linkedin,
  whatsapp: MessageCircle,
};

function ItemsGrid({
  count,
  gap,
  children,
  className,
}: {
  count: number;
  gap: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid w-full max-w-full",
        count <= 1 && "grid-cols-1",
        count === 2 && "grid-cols-1 md:grid-cols-2",
        count >= 3 && "grid-cols-1 md:grid-cols-3",
        className,
      )}
      style={{ gap: `${gap}px` }}
    >
      {children}
    </div>
  );
}

export function AccordionBlock({ element }: { element: LandingElement }) {
  const items = (element.content.items as Array<{ question: string; answer: string }>) || [];
  const [open, setOpen] = useState<number | null>(0);
  const box = elementBoxStyle(element.styles);
  const vis = elementVisibilityClass(element.styles);

  return (
    <div className={cn("w-full max-w-full space-y-2", vis)} style={box}>
      {items.map((item, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl border border-border/70 bg-card"
        >
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start text-sm font-medium"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
          >
            <span>{str(item.question)}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 transition-transform",
                open === i && "rotate-180",
              )}
            />
          </button>
          {open === i ? (
            <div className="border-t border-border/60 px-4 py-3 text-sm text-muted-foreground">
              {str(item.answer)}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function TabsBlock({ element }: { element: LandingElement }) {
  const items =
    (element.content.items as Array<{ label: string; content: string }>) || [];
  const vis = elementVisibilityClass(element.styles);
  if (!items.length) return null;

  return (
    <div className={cn("w-full max-w-full", vis)}>
      <Tabs defaultValue="0" dir="rtl">
        <TabsList className="mb-4 flex w-full flex-wrap">
          {items.map((item, i) => (
            <TabsTrigger key={i} value={String(i)} className="flex-1">
              {str(item.label, `تب ${i + 1}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        {items.map((item, i) => (
          <TabsContent key={i} value={String(i)}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {str(item.content)}
            </p>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export function CountdownBlock({ element }: { element: LandingElement }) {
  const target = str(element.content.targetDate);
  const labels = (element.content.labels as Record<string, string>) || {};
  const [left, setLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const vis = elementVisibilityClass(element.styles);
  const box = elementBoxStyle(element.styles);

  useEffect(() => {
    const tick = () => {
      const diff = new Date(target).getTime() - Date.now();
      if (diff <= 0) {
        setLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      setLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff / 3600000) % 24),
        minutes: Math.floor((diff / 60000) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [target]);

  const parts = [
    { value: left.days, label: labels.days || "روز" },
    { value: left.hours, label: labels.hours || "ساعت" },
    { value: left.minutes, label: labels.minutes || "دقیقه" },
    { value: left.seconds, label: labels.seconds || "ثانیه" },
  ];

  return (
    <div
      className={cn("flex flex-wrap justify-center gap-4", vis)}
      style={{ textAlign: box.textAlign }}
    >
      {parts.map((part) => (
        <div
          key={part.label}
          className="flex min-w-[72px] flex-col items-center rounded-xl bg-muted px-4 py-3"
        >
          <span className="text-2xl font-bold tabular-nums">{part.value}</span>
          <span className="text-xs text-muted-foreground">{part.label}</span>
        </div>
      ))}
    </div>
  );
}

export function SocialLinksBlock({ element }: { element: LandingElement }) {
  const items =
    (element.content.items as Array<{ platform: string; url: string }>) || [];
  const vis = elementVisibilityClass(element.styles);
  const box = elementBoxStyle(element.styles);

  return (
    <div
      className={cn("flex flex-wrap items-center justify-center", vis)}
      style={{ gap: `${element.styles.gap || 12}px`, textAlign: box.textAlign }}
    >
      {items.map((item, i) => {
        const Icon = SOCIAL_ICONS[item.platform] || MessageCircle;
        const href = str(item.url);
        if (!href) return null;
        return (
          <Link
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card transition-colors hover:border-brand/40 hover:bg-brand/5"
            aria-label={item.platform}
          >
            <Icon className="h-4 w-4" />
          </Link>
        );
      })}
    </div>
  );
}

export function WhatsappCtaBlock({ element }: { element: LandingElement }) {
  const phone = str(element.content.phone).replace(/\D/g, "");
  const message = encodeURIComponent(str(element.content.message));
  const href = phone ? `https://wa.me/${phone}?text=${message}` : "#";
  const vis = elementVisibilityClass(element.styles);

  return (
    <div className={cn("w-full", vis)} style={{ textAlign: element.styles.align }}>
      <Button asChild variant="brand" className="rounded-xl gap-2">
        <Link href={href} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="h-4 w-4" />
          {str(element.content.text).trim()}
        </Link>
      </Button>
    </div>
  );
}

export function FeatureCardsBlock({ element }: { element: LandingElement }) {
  const items =
    (element.content.items as Array<{
      title: string;
      description: string;
      icon?: string;
    }>) || [];
  const gap = element.styles.gap || 24;
  const vis = elementVisibilityClass(element.styles);

  return (
    <ItemsGrid count={Math.min(3, items.length || 1)} gap={gap}>
      {items.map((item, i) => (
        <div
          key={i}
          className={cn(
            "rounded-2xl border border-border/70 bg-card p-6 text-center",
            vis,
          )}
        >
          <h3 className="mb-2 font-semibold">{str(item.title)}</h3>
          <p className="text-sm text-muted-foreground">{str(item.description)}</p>
        </div>
      ))}
    </ItemsGrid>
  );
}

export function PricingCardsBlock({ element }: { element: LandingElement }) {
  const items =
    (element.content.items as Array<{
      title: string;
      price: string;
      description: string;
      features: string[];
      badge?: string;
      url?: string;
    }>) || [];
  const gap = element.styles.gap || 24;
  const vis = elementVisibilityClass(element.styles);

  return (
    <ItemsGrid count={Math.min(3, items.length || 1)} gap={gap}>
      {items.map((item, i) => (
        <div
          key={i}
          className={cn(
            "relative flex flex-col rounded-2xl border border-border/70 bg-card p-6",
            vis,
          )}
        >
          {item.badge ? (
            <span className="absolute -top-3 start-4 rounded-full bg-brand px-3 py-0.5 text-xs font-medium text-brand-foreground">
              {item.badge}
            </span>
          ) : null}
          <h3 className="text-lg font-semibold">{str(item.title)}</h3>
          <p className="mt-1 text-2xl font-bold">{str(item.price)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {str(item.description)}
          </p>
          <ul className="my-4 flex-1 space-y-2 text-sm">
            {(item.features || []).map((f, j) => (
              <li key={j} className="flex items-center gap-2">
                <span className="text-brand">✓</span>
                {f}
              </li>
            ))}
          </ul>
          <Button asChild variant="brand" className="w-full rounded-xl">
            <Link href={str(item.url, "#contact")}>
              {str(item.price).includes("تماس") ? "تماس" : "انتخاب"}
            </Link>
          </Button>
        </div>
      ))}
    </ItemsGrid>
  );
}

export function TestimonialCardsBlock({ element }: { element: LandingElement }) {
  const items =
    (element.content.items as Array<{
      quote: string;
      author: string;
      role: string;
      rating?: number;
    }>) || [];
  const gap = element.styles.gap || 24;
  const vis = elementVisibilityClass(element.styles);

  return (
    <ItemsGrid count={Math.min(2, items.length || 1)} gap={gap}>
      {items.map((item, i) => (
        <blockquote
          key={i}
          className={cn(
            "rounded-2xl border border-border/70 bg-card p-6",
            vis,
          )}
        >
          <div className="mb-3 flex gap-0.5">
            {Array.from({ length: num(item.rating, 5) }).map((_, j) => (
              <Star key={j} className="h-4 w-4 fill-brand text-brand" />
            ))}
          </div>
          <p className="mb-4 text-sm leading-relaxed">&ldquo;{str(item.quote)}&rdquo;</p>
          <footer className="text-sm">
            <strong>{str(item.author)}</strong>
            {item.role ? (
              <span className="text-muted-foreground"> — {item.role}</span>
            ) : null}
          </footer>
        </blockquote>
      ))}
    </ItemsGrid>
  );
}

export function TeamCardsBlock({ element }: { element: LandingElement }) {
  const items =
    (element.content.items as Array<{
      name: string;
      role: string;
      imageSrc?: string;
      imageKey?: string | null;
      mobileImageSrc?: string;
      mobileImageKey?: string | null;
    }>) || [];
  const gap = element.styles.gap || 24;
  const vis = elementVisibilityClass(element.styles);

  return (
    <ItemsGrid count={Math.min(3, items.length || 1)} gap={gap}>
      {items.map((item, i) => (
        <figure key={i} className={cn("text-center", vis)}>
          <div className="relative mx-auto mb-3 aspect-square w-32 overflow-hidden rounded-full bg-muted">
            <ResponsiveCoverImage
              desktopSrc={item.imageSrc}
              mobileSrc={item.mobileImageSrc}
              alt={str(item.name)}
              desktopSizes="128px"
              mobileSizes="128px"
            />
          </div>
          <figcaption>
            <p className="font-semibold">{str(item.name)}</p>
            <p className="text-sm text-muted-foreground">{str(item.role)}</p>
          </figcaption>
        </figure>
      ))}
    </ItemsGrid>
  );
}

export function StatsBlock({ element }: { element: LandingElement }) {
  const items =
    (element.content.items as Array<{ value: string; label: string }>) || [];
  const gap = element.styles.gap || 32;
  const vis = elementVisibilityClass(element.styles);
  const box = elementBoxStyle(element.styles);

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-6 lg:grid-cols-4",
        vis,
      )}
      style={{ gap: `${gap}px`, color: box.color }}
    >
      {items.map((item, i) => (
        <div key={i} className="text-center">
          <p className="text-3xl font-bold tabular-nums">{str(item.value)}</p>
          <p className="mt-1 text-sm opacity-80">{str(item.label)}</p>
        </div>
      ))}
    </div>
  );
}

export function TimelineBlock({ element }: { element: LandingElement }) {
  const items =
    (element.content.items as Array<{
      title: string;
      description: string;
      date: string;
    }>) || [];
  const vis = elementVisibilityClass(element.styles);

  return (
    <div className={cn("relative space-y-6 border-s-2 border-brand/30 ps-6", vis)}>
      {items.map((item, i) => (
        <div key={i} className="relative">
          <span className="absolute -start-[31px] top-1 h-3 w-3 rounded-full bg-brand" />
          {item.date ? (
            <time className="mb-1 block text-xs text-muted-foreground">
              {item.date}
            </time>
          ) : null}
          <h4 className="font-semibold">{str(item.title)}</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            {str(item.description)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function GalleryBlock({ element }: { element: LandingElement }) {
  const items =
    (element.content.items as Array<{
      alt: string;
      imageSrc?: string;
      imageKey?: string | null;
      mobileImageSrc?: string;
      mobileImageKey?: string | null;
    }>) || [];
  const cols = num(element.content.columns, 3);
  const vis = elementVisibilityClass(element.styles);
  const box = elementBoxStyle(element.styles);

  return (
    <div
      className={cn(
        "grid w-full max-w-full",
        cols <= 2
          ? "grid-cols-1 md:grid-cols-2"
          : "grid-cols-1 md:grid-cols-3",
        vis,
      )}
      style={{ gap: `${element.styles.gap || 12}px`, ...box }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted"
        >
          <ResponsiveCoverImage
            desktopSrc={item.imageSrc}
            mobileSrc={item.mobileImageSrc}
            alt={str(item.alt)}
            desktopSizes="400px"
            mobileSizes="100vw"
            fallback={
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                {str(item.alt, "تصویر")}
              </div>
            }
          />
        </div>
      ))}
    </div>
  );
}

export function SliderBlock({ element }: { element: LandingElement }) {
  const items =
    (element.content.items as Array<{
      alt: string;
      imageSrc?: string;
      mobileImageSrc?: string;
    }>) || [];
  const [index, setIndex] = useState(0);
  const autoplay = bool(element.content.autoplay, true);
  const interval = num(element.content.interval, 5000);
  const vis = elementVisibilityClass(element.styles);
  const box = elementBoxStyle(element.styles);

  useEffect(() => {
    if (!autoplay || items.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, interval);
    return () => window.clearInterval(id);
  }, [autoplay, interval, items.length]);

  if (!items.length) return null;
  const current = items[index];

  return (
    <div
      className={cn("relative w-full max-w-full overflow-hidden", vis)}
      style={{ borderRadius: box.borderRadius }}
    >
      <div className="relative aspect-[16/9] bg-muted">
        <ResponsiveCoverImage
          desktopSrc={current.imageSrc}
          mobileSrc={current.mobileImageSrc}
          alt={str(current.alt)}
          desktopSizes="960px"
          mobileSizes="100vw"
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {str(current.alt, "اسلاید")}
            </div>
          }
        />
      </div>
      {items.length > 1 ? (
        <div className="absolute bottom-3 start-1/2 flex -translate-x-1/2 gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                i === index ? "bg-brand" : "bg-white/60",
              )}
              onClick={() => setIndex(i)}
              aria-label={`اسلاید ${i + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function BeforeAfterBlock({ element }: { element: LandingElement }) {
  const beforeDesktop = str(element.content.beforeSrc);
  const beforeMobile = str(element.content.mobileBeforeSrc);
  const afterDesktop = str(element.content.afterSrc);
  const afterMobile = str(element.content.mobileAfterSrc);
  const [pos, setPos] = useState(50);
  const vis = elementVisibilityClass(element.styles);
  const box = elementBoxStyle(element.styles);

  return (
    <div
      className={cn("relative aspect-[16/9] w-full max-w-full select-none overflow-hidden bg-muted", vis)}
      style={{ borderRadius: box.borderRadius }}
    >
      <ResponsiveCoverImage
        desktopSrc={afterDesktop || null}
        mobileSrc={afterMobile || null}
        alt={str(element.content.afterAlt, "بعد")}
        desktopSizes="960px"
        mobileSizes="100vw"
      />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <ResponsiveCoverImage
          desktopSrc={beforeDesktop || null}
          mobileSrc={beforeMobile || null}
          alt={str(element.content.beforeAlt, "قبل")}
          desktopSizes="960px"
          mobileSizes="100vw"
        />
      </div>
      <input
        type="range"
        min={5}
        max={95}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        className="absolute inset-x-4 bottom-4 z-10 w-[calc(100%-2rem)]"
        aria-label={str(element.content.label, "مقایسه قبل و بعد")}
      />
    </div>
  );
}
