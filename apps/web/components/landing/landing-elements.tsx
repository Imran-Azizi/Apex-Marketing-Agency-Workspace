"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BriefcaseBusiness,
  Building2,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  CircleHelp,
  Clock,
  ExternalLink,
  Film,
  Globe,
  Handshake,
  Heart,
  Image as ImageIcon,
  Info,
  Mail,
  MapPin,
  MessageCircle,
  Mic,
  Music,
  Pause,
  Phone,
  Play,
  Quote,
  Send,
  Shield,
  Sparkles,
  Star,
  Target,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { ResponsiveCoverImage } from "@/components/landing/responsive-cover-image";
import { pickResponsiveImageSrc } from "@/lib/landing-responsive-image";
import { VideoPlayer } from "@/components/media/video-player";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  bool,
  normalizeElement,
  num,
  str,
  type LandingElement,
} from "@/lib/landing-content";
import {
  elementBoxStyle,
  elementVisibilityClass,
} from "@/lib/landing-styles";
import {
  AccordionBlock,
  BeforeAfterBlock,
  CountdownBlock,
  FeatureCardsBlock,
  GalleryBlock,
  PricingCardsBlock,
  SliderBlock,
  SocialLinksBlock,
  StatsBlock,
  TabsBlock,
  TeamCardsBlock,
  TestimonialCardsBlock,
  TimelineBlock,
  WhatsappCtaBlock,
} from "@/components/landing/landing-element-blocks";

const ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Star,
  Heart,
  Check,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Play,
  Pause,
  ArrowLeft,
  ArrowRight,
  Globe,
  Users,
  BriefcaseBusiness,
  Camera,
  Film,
  Image: ImageIcon,
  Music,
  Mic,
  MessageCircle,
  Send,
  Shield,
  Award,
  Zap,
  Target,
  Clock,
  Calendar,
  Building2,
  Handshake,
  Quote,
  CircleHelp,
  Info,
  ExternalLink,
};

export { elementVisibilityClass, elementBoxStyle };

function ElementWrapper({
  element,
  children,
  style,
  className,
}: {
  element: LandingElement;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  if (element.hidden) return null;
  return (
    <div className={cn("landing-el w-full min-w-0 max-w-full", className)} style={style}>
      {children}
    </div>
  );
}

function HeadingTag({
  level,
  className,
  style,
  children,
}: {
  level: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const cls = cn(
    "max-w-full break-words text-balance font-bold tracking-tight",
    className,
  );
  if (level <= 1)
    return (
      <h1 className={cls} style={style}>
        {children}
      </h1>
    );
  if (level === 3)
    return (
      <h3 className={cls} style={style}>
        {children}
      </h3>
    );
  if (level >= 4)
    return (
      <h4 className={cls} style={style}>
        {children}
      </h4>
    );
  return (
    <h2 className={cls} style={style}>
      {children}
    </h2>
  );
}

export function LandingElementView({ element: raw }: { element: LandingElement }) {
  const element = normalizeElement(raw);
  if (element.hidden) return null;
  const { type, content, styles } = element;
  const box = elementBoxStyle(styles);
  const vis = elementVisibilityClass(styles);

  if (type === "heading") {
    const text = str(content.text).trim();
    const heading = (
      <HeadingTag level={num(content.level, 2)} className={vis} style={box}>
        {text}
      </HeadingTag>
    );
    const href = str(content.linkUrl);
    if (href) {
      const external = /^https?:/i.test(href);
      return (
        <ElementWrapper element={element}>
          <Link
            href={href}
            target={bool(content.linkNewTab) || external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            className="block max-w-full no-underline"
          >
            {heading}
          </Link>
        </ElementWrapper>
      );
    }
    return <ElementWrapper element={element}>{heading}</ElementWrapper>;
  }

  if (type === "paragraph" || type === "text") {
    const body = (
      <p
        className={cn(
          "max-w-full whitespace-pre-wrap break-words text-pretty",
          vis,
        )}
        style={box}
      >
        {str(content.text)}
      </p>
    );
    const href = str(content.linkUrl);
    if (href) {
      const external = /^https?:/i.test(href);
      return (
        <ElementWrapper element={element}>
          <Link
            href={href}
            target={bool(content.linkNewTab) || external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            className="block max-w-full no-underline"
          >
            {body}
          </Link>
        </ElementWrapper>
      );
    }
    return <ElementWrapper element={element}>{body}</ElementWrapper>;
  }

  if (type === "quote") {
    return (
      <ElementWrapper element={element}>
        <blockquote
          className={cn("max-w-full border-s-4 border-brand ps-4 italic", vis)}
          style={box}
        >
          <p>{str(content.text)}</p>
          {str(content.author) ? (
            <footer className="mt-2 text-sm not-italic opacity-70">
              — {str(content.author)}
            </footer>
          ) : null}
        </blockquote>
      </ElementWrapper>
    );
  }

  if (type === "list") {
    const items = (content.items as string[]) || [];
    const Tag = bool(content.ordered) ? "ol" : "ul";
    return (
      <ElementWrapper element={element}>
        <Tag
          className={cn(
            "max-w-full space-y-1",
            bool(content.ordered) ? "list-decimal pe-5" : "list-disc pe-5",
            vis,
          )}
          style={box}
        >
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </Tag>
      </ElementWrapper>
    );
  }

  if (type === "image") {
    const desktopSrc = str(content.imageSrc || content.imageUrl);
    const mobileSrc = str(content.mobileImageSrc || content.mobileImageUrl);
    const objectFitClass = cn(
      styles.objectFit === "contain" && "object-contain",
      styles.objectFit === "fill" && "object-fill",
      styles.objectFit === "none" && "object-none",
    );
    const inner = (
      <div
        className={cn("relative w-full max-w-full overflow-hidden", vis)}
        style={{
          ...box,
          height: num(content.height) > 0 ? num(content.height) : undefined,
          aspectRatio: num(content.height) > 0 ? undefined : "16 / 9",
        }}
      >
        <ResponsiveCoverImage
          desktopSrc={desktopSrc || null}
          mobileSrc={mobileSrc || null}
          alt={str(content.alt, "")}
          desktopSizes="(max-width: 1280px) 100vw, 960px"
          mobileSizes="100vw"
          className={objectFitClass}
          fallback={
            <div
              className="h-full min-h-[180px] bg-muted/40"
              aria-hidden
            />
          }
        />
      </div>
    );
    const href = str(content.linkUrl);
    if (href) {
      const external = /^https?:/i.test(href);
      return (
        <ElementWrapper element={element}>
          <Link
            href={href}
            target={bool(content.linkNewTab) || external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            className="block max-w-full"
          >
            {inner}
          </Link>
        </ElementWrapper>
      );
    }
    return <ElementWrapper element={element}>{inner}</ElementWrapper>;
  }

  if (type === "gallery") {
    return (
      <ElementWrapper element={element}>
        <GalleryBlock element={element} />
      </ElementWrapper>
    );
  }

  if (type === "slider") {
    return (
      <ElementWrapper element={element}>
        <SliderBlock element={element} />
      </ElementWrapper>
    );
  }

  if (type === "before-after") {
    return (
      <ElementWrapper element={element}>
        <BeforeAfterBlock element={element} />
      </ElementWrapper>
    );
  }

  if (type === "video") {
    const src = str(content.videoSrc || content.videoUrl);
    const poster = pickResponsiveImageSrc(
      str(content.posterSrc) || null,
      str(content.mobilePosterSrc) || null,
    );
    return (
      <ElementWrapper element={element}>
        <div className={cn("w-full max-w-full overflow-hidden", vis)} style={box}>
          {src ? (
            <VideoPlayer
              className="w-full"
              src={src}
              poster={poster || undefined}
              autoPlay={bool(content.autoplay)}
              muted={bool(content.muted, bool(content.autoplay))}
              loop={bool(content.loop)}
              controls={bool(content.controls, true)}
            />
          ) : (
            <div
              className="aspect-video w-full rounded-xl bg-muted/40"
              aria-hidden
            />
          )}
        </div>
      </ElementWrapper>
    );
  }

  if (type === "audio") {
    const src = str(content.audioSrc || content.audioUrl);
    return (
      <ElementWrapper element={element}>
        <figure className={cn("w-full max-w-full", vis)} style={box}>
          {str(content.title) ? (
            <figcaption className="mb-2 text-sm font-medium">
              {str(content.title)}
            </figcaption>
          ) : null}
          {src ? (
            <audio
              className="w-full max-w-full"
              src={src}
              controls
              preload="none"
              autoPlay={bool(content.autoplay)}
              loop={bool(content.loop)}
            />
          ) : (
            <div className="min-h-[48px] rounded-lg bg-muted/40" aria-hidden />
          )}
        </figure>
      </ElementWrapper>
    );
  }

  if (type === "button" || type === "link") {
    const href = str(content.url, "#contact");
    const variant = str(content.variant, "brand") as
      | "brand"
      | "outline"
      | "secondary";
    const external = /^https?:/i.test(href);
    return (
      <ElementWrapper element={element}>
        <div
          className={cn("w-full", vis)}
          style={{
            textAlign: styles.align,
            marginTop: box.marginTop,
            marginBottom: box.marginBottom,
          }}
        >
          <Button
            asChild
            variant={
              variant === "outline" || variant === "secondary"
                ? variant
                : "brand"
            }
            className="max-w-full rounded-xl"
            style={{
              backgroundColor: styles.backgroundColor || undefined,
              color: styles.color || undefined,
              borderRadius: styles.borderRadius
                ? `${styles.borderRadius}px`
                : undefined,
              padding: styles.padding
                ? `${styles.padding}px ${Math.max(styles.padding * 2, 16)}px`
                : undefined,
            }}
          >
            <Link
              href={href}
              target={
                bool(content.openInNewTab) || external ? "_blank" : undefined
              }
              rel={external ? "noopener noreferrer" : undefined}
            >
              {str(content.text).trim()}
            </Link>
          </Button>
        </div>
      </ElementWrapper>
    );
  }

  if (type === "icon-button") {
    const Icon = ICONS[str(content.name, "ArrowLeft")] || ArrowLeft;
    const href = str(content.url, "#contact");
    const size = num(content.size, 40);
    const external = /^https?:/i.test(href);
    return (
      <ElementWrapper element={element}>
        <div className={cn("w-full", vis)} style={{ textAlign: styles.align }}>
          <Button
            asChild
            size="icon"
            variant={
              str(content.variant, "brand") === "outline" ? "outline" : "brand"
            }
            className="rounded-full"
            style={{ width: size, height: size }}
          >
            <Link
              href={href}
              target={
                bool(content.openInNewTab) || external ? "_blank" : undefined
              }
              rel={external ? "noopener noreferrer" : undefined}
            >
              <Icon style={{ width: size * 0.45, height: size * 0.45 }} />
            </Link>
          </Button>
        </div>
      </ElementWrapper>
    );
  }

  if (type === "icon") {
    const Icon = ICONS[str(content.name, "Sparkles")] || Sparkles;
    const href = str(content.url);
    const node = (
      <span className={cn("inline-flex", vis)} style={{ ...box, width: "auto" }}>
        <Icon
          style={{
            width: num(content.size, 32),
            height: num(content.size, 32),
            color: styles.color || "currentColor",
          }}
        />
      </span>
    );
    return (
      <ElementWrapper element={element}>
        <div style={{ textAlign: styles.align, marginBottom: box.marginBottom }}>
          {href ? (
            <Link href={href} className="inline-flex">
              {node}
            </Link>
          ) : (
            node
          )}
        </div>
      </ElementWrapper>
    );
  }

  if (type === "social-links") {
    return (
      <ElementWrapper element={element}>
        <SocialLinksBlock element={element} />
      </ElementWrapper>
    );
  }

  if (type === "whatsapp-cta") {
    return (
      <ElementWrapper element={element}>
        <WhatsappCtaBlock element={element} />
      </ElementWrapper>
    );
  }

  if (type === "accordion" || type === "faq") {
    return (
      <ElementWrapper element={element}>
        <AccordionBlock element={element} />
      </ElementWrapper>
    );
  }

  if (type === "tabs") {
    return (
      <ElementWrapper element={element}>
        <TabsBlock element={element} />
      </ElementWrapper>
    );
  }

  if (type === "countdown") {
    return (
      <ElementWrapper element={element}>
        <CountdownBlock element={element} />
      </ElementWrapper>
    );
  }

  if (type === "feature-cards") {
    return (
      <ElementWrapper element={element}>
        <FeatureCardsBlock element={element} />
      </ElementWrapper>
    );
  }

  if (type === "pricing-cards") {
    return (
      <ElementWrapper element={element}>
        <PricingCardsBlock element={element} />
      </ElementWrapper>
    );
  }

  if (type === "testimonial-cards") {
    return (
      <ElementWrapper element={element}>
        <TestimonialCardsBlock element={element} />
      </ElementWrapper>
    );
  }

  if (type === "team-cards") {
    return (
      <ElementWrapper element={element}>
        <TeamCardsBlock element={element} />
      </ElementWrapper>
    );
  }

  if (type === "stats") {
    return (
      <ElementWrapper element={element}>
        <StatsBlock element={element} />
      </ElementWrapper>
    );
  }

  if (type === "timeline") {
    return (
      <ElementWrapper element={element}>
        <TimelineBlock element={element} />
      </ElementWrapper>
    );
  }

  if (type === "divider") {
    return (
      <ElementWrapper element={element}>
        <hr
          className={cn("max-w-full border-0 bg-border", vis)}
          style={{
            height: Math.max(1, num(content.thickness, 1)),
            marginTop: box.marginTop,
            marginBottom: box.marginBottom,
            backgroundColor: styles.color || undefined,
          }}
        />
      </ElementWrapper>
    );
  }

  if (type === "spacer") {
    return (
      <ElementWrapper element={element}>
        <div className={vis} style={{ height: num(content.height, 32) }} aria-hidden />
      </ElementWrapper>
    );
  }

  if (type === "columns") {
    const count = Math.min(4, Math.max(2, num(content.count, 2)));
    const cols = element.columns || [];
    return (
      <ElementWrapper element={element}>
        <div
          className={cn(
            "grid max-w-full gap-4",
            count === 2 && "md:grid-cols-2",
            count === 3 && "md:grid-cols-2 lg:grid-cols-3",
            count >= 4 && "sm:grid-cols-2 lg:grid-cols-4",
            vis,
          )}
          style={box}
        >
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="min-w-0">
              {(cols[i] || []).map((child) => (
                <LandingElementView key={child.id} element={child} />
              ))}
            </div>
          ))}
        </div>
      </ElementWrapper>
    );
  }

  if (type === "grid") {
    const count = Math.min(4, Math.max(1, num(content.columns, 3)));
    const cols = element.columns || [];
    return (
      <ElementWrapper element={element}>
        <div
          className={cn(
            "grid w-full max-w-full",
            count === 2 && "grid-cols-1 md:grid-cols-2",
            count === 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
            count >= 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
            vis,
          )}
          style={{ gap: `${styles.gap || 16}px`, ...box }}
        >
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="min-w-0">
              {(cols[i] || []).map((child) => (
                <LandingElementView key={child.id} element={child} />
              ))}
            </div>
          ))}
        </div>
      </ElementWrapper>
    );
  }

  return null;
}

export function LandingElements({ elements }: { elements: LandingElement[] }) {
  return (
    <>
      {elements.map((element) => (
        <LandingElementView key={element.id} element={element} />
      ))}
    </>
  );
}
