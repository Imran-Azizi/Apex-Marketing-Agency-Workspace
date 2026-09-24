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
import { CoverImage } from "@/components/media/cover-image";
import { VideoPlayer } from "@/components/media/video-player";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  bool,
  num,
  str,
  type LandingElement,
  type LandingElementStyles,
} from "@/lib/landing-content";

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

export function elementVisibilityClass(styles: LandingElementStyles) {
  return cn(
    styles.hiddenOnMobile && "hidden md:block",
    styles.hiddenOnDesktop && "md:hidden",
  );
}

export function elementBoxStyle(styles: LandingElementStyles): CSSProperties {
  return {
    fontSize: styles.fontSize ? `${styles.fontSize}px` : undefined,
    fontWeight: styles.fontWeight || undefined,
    fontFamily: styles.fontFamily || undefined,
    color: styles.color || undefined,
    textAlign: styles.align,
    lineHeight: styles.lineHeight || undefined,
    letterSpacing: styles.letterSpacing ? `${styles.letterSpacing}px` : undefined,
    marginTop: styles.marginTop ? `${styles.marginTop}px` : undefined,
    marginBottom: styles.marginBottom ? `${styles.marginBottom}px` : undefined,
    padding: styles.padding ? `${styles.padding}px` : undefined,
    width: styles.width || "100%",
    maxWidth: "100%",
    backgroundColor: styles.backgroundColor || undefined,
    borderColor: styles.borderColor || undefined,
    borderWidth: styles.borderWidth || undefined,
    borderStyle: styles.borderWidth ? "solid" : undefined,
    borderRadius: styles.borderRadius ? `${styles.borderRadius}px` : undefined,
  };
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
  const cls = cn("max-w-full break-words text-balance font-bold tracking-tight", className);
  if (level <= 1) return <h1 className={cls} style={style}>{children}</h1>;
  if (level === 3) return <h3 className={cls} style={style}>{children}</h3>;
  if (level >= 4) return <h4 className={cls} style={style}>{children}</h4>;
  return <h2 className={cls} style={style}>{children}</h2>;
}

export function LandingElementView({
  element,
}: {
  element: LandingElement;
}) {
  const { type, content, styles } = element;
  const box = elementBoxStyle(styles);
  const vis = elementVisibilityClass(styles);

  if (type === "heading") {
    return (
      <HeadingTag level={num(content.level, 2)} className={vis} style={box}>
        {str(content.text, "عنوان")}
      </HeadingTag>
    );
  }

  if (type === "paragraph" || type === "text") {
    return (
      <p
        className={cn("max-w-full whitespace-pre-wrap break-words text-pretty", vis)}
        style={box}
      >
        {str(content.text)}
      </p>
    );
  }

  if (type === "image") {
    const src = str(content.imageSrc || content.imageUrl);
    const inner = (
      <div
        className={cn("relative w-full max-w-full overflow-hidden", vis)}
        style={{
          ...box,
          height: num(content.height) > 0 ? num(content.height) : undefined,
          aspectRatio: num(content.height) > 0 ? undefined : "16 / 9",
        }}
      >
        {src ? (
          <CoverImage
            src={src}
            alt={str(content.alt, "")}
            sizes="(max-width: 768px) 100vw, 960px"
            className={cn(
              styles.objectFit === "contain" && "object-contain",
              styles.objectFit === "fill" && "object-fill",
              styles.objectFit === "none" && "object-none",
            )}
          />
        ) : (
          <div className="flex h-full min-h-[180px] items-center justify-center bg-muted text-sm text-muted-foreground">
            تصویر انتخاب نشده
          </div>
        )}
      </div>
    );
    const href = str(content.linkUrl);
    if (href) {
      const external = /^https?:/i.test(href);
      return (
        <Link
          href={href}
          target={bool(content.linkNewTab) || external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          className="block max-w-full"
        >
          {inner}
        </Link>
      );
    }
    return inner;
  }

  if (type === "video") {
    const src = str(content.videoSrc || content.videoUrl);
    return (
      <div className={cn("w-full max-w-full overflow-hidden", vis)} style={box}>
        {src ? (
          <VideoPlayer
            src={src}
            poster={str(content.posterSrc) || undefined}
            autoPlay={bool(content.autoplay)}
            muted={bool(content.muted, bool(content.autoplay))}
            loop={bool(content.loop)}
            controls={bool(content.controls, true)}
          />
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
            ویدیو انتخاب نشده
          </div>
        )}
      </div>
    );
  }

  if (type === "audio") {
    const src = str(content.audioSrc || content.audioUrl);
    return (
      <figure className={cn("w-full max-w-full", vis)} style={box}>
        {str(content.title) ? (
          <figcaption className="mb-2 text-sm font-medium">{str(content.title)}</figcaption>
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
          <p className="text-sm text-muted-foreground">فایل صوتی انتخاب نشده</p>
        )}
      </figure>
    );
  }

  if (type === "button" || type === "link") {
    const href = str(content.url, "#contact");
    const variant = str(content.variant, "brand") as "brand" | "outline" | "secondary";
    const external = /^https?:/i.test(href);
    return (
      <div className={cn("w-full", vis)} style={{ textAlign: styles.align, marginTop: box.marginTop, marginBottom: box.marginBottom }}>
        <Button
          asChild
          variant={variant === "outline" || variant === "secondary" ? variant : "brand"}
          className="max-w-full rounded-xl"
          style={{
            backgroundColor: styles.backgroundColor || undefined,
            color: styles.color || undefined,
            borderRadius: styles.borderRadius ? `${styles.borderRadius}px` : undefined,
            padding: styles.padding ? `${styles.padding}px ${Math.max(styles.padding * 2, 16)}px` : undefined,
          }}
        >
          <Link
            href={href}
            target={bool(content.openInNewTab) || external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
          >
            {str(content.text, "دکمه")}
          </Link>
        </Button>
      </div>
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
      <div style={{ textAlign: styles.align, marginBottom: box.marginBottom }}>
        {href ? (
          <Link href={href} className="inline-flex">
            {node}
          </Link>
        ) : (
          node
        )}
      </div>
    );
  }

  if (type === "divider") {
    return (
      <hr
        className={cn("max-w-full border-0 bg-border", vis)}
        style={{
          height: Math.max(1, num(content.thickness, 1)),
          marginTop: box.marginTop,
          marginBottom: box.marginBottom,
          backgroundColor: styles.color || undefined,
        }}
      />
    );
  }

  if (type === "spacer") {
    return <div className={vis} style={{ height: num(content.height, 32) }} aria-hidden />;
  }

  if (type === "columns") {
    const count = Math.min(3, Math.max(2, num(content.count, 2)));
    const cols = element.columns || [];
    return (
      <div
        className={cn("grid max-w-full gap-4 md:grid-cols-2", count === 3 && "lg:grid-cols-3", vis)}
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
    );
  }

  return null;
}

export function LandingElements({
  elements,
}: {
  elements: LandingElement[];
}) {
  return (
    <>
      {elements.map((element) => (
        <LandingElementView key={element.id} element={element} />
      ))}
    </>
  );
}
