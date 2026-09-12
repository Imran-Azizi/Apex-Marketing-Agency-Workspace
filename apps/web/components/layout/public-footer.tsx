"use client";

import Link from "next/link";
import { Mail, MessageCircle, Phone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { PUBLIC_NAV_ITEMS } from "@/components/public/use-active-section";
import { usePublicSectionNav } from "@/components/public/use-public-nav";
import { COMPANY_INTRO_TITLE } from "@/lib/company";
import {
  configuredContactChannels,
  CONTACT_HOURS_TEXT,
  type ContactChannel,
  type PublicContactInfo,
} from "@/lib/contact";
import { serviceTitle, type PublicService } from "@/lib/services";
import { cn } from "@/lib/utils";

const SERVICE_PREVIEW_LIMIT = 6;

const CHANNEL_ICONS: Record<ContactChannel["id"], LucideIcon> = {
  whatsapp: MessageCircle,
  phone: Phone,
  email: Mail,
};

const linkClass =
  "rounded-sm text-sm leading-7 text-muted-foreground transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-xs font-semibold tracking-wide text-brand">
      {children}
    </p>
  );
}

function ChannelIconButton({ channel }: { channel: ContactChannel }) {
  const Icon = CHANNEL_ICONS[channel.id];
  const isExternal = channel.href.startsWith("http");

  return (
    <a
      href={channel.href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      aria-label={channel.label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-card/70 text-muted-foreground",
        "transition-colors hover:border-brand/40 hover:bg-brand/10 hover:text-brand",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </a>
  );
}

export function PublicFooter({
  initialServices,
  initialContact,
  companyDescription,
}: {
  initialServices?: PublicService[] | null;
  initialContact?: PublicContactInfo | null;
  companyDescription?: string | null;
}) {
  const year = new Date().getFullYear();
  const { goToSection } = usePublicSectionNav();
  const services = initialServices || [];
  const contact = initialContact || undefined;
  const publishedServices = services.slice(0, SERVICE_PREVIEW_LIMIT);
  const hasMoreServices = services.length > SERVICE_PREVIEW_LIMIT;
  const channels = configuredContactChannels(contact);
  const aboutText = String(companyDescription || "").trim();

  return (
    <footer
      className="relative border-t border-border/60 bg-muted/25"
      aria-label="پاورقی وب‌سایت"
    >

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between lg:gap-16">
          <div className="max-w-sm shrink-0">
            <a
              href="/#home"
              onClick={(event) => goToSection("home", event)}
              className="inline-flex rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`${COMPANY_INTRO_TITLE} — بازگشت به خانه`}
            >
              <Logo size="sm" wordmarkClassName="text-foreground" />
            </a>
            <p className="mt-4 text-sm font-semibold tracking-tight text-foreground">
              {COMPANY_INTRO_TITLE}
            </p>
            {aboutText ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-8 text-muted-foreground">
                {aboutText}
              </p>
            ) : null}
          </div>

          <div className="grid flex-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
            <nav aria-label="پیوندهای سریع">
              <FooterHeading>پیوندهای سریع</FooterHeading>
              <ul className="space-y-1">
                {PUBLIC_NAV_ITEMS.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`/#${item.id}`}
                      onClick={(event) => goToSection(item.id, event)}
                      className={linkClass}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="خدمات">
              <FooterHeading>خدمات</FooterHeading>
              {publishedServices.length > 0 ? (
                <>
                  <ul className="space-y-1">
                    {publishedServices.map((service) => (
                      <li key={service.id}>
                        <a
                          href="/#services"
                          onClick={(event) => goToSection("services", event)}
                          className={cn(linkClass, "line-clamp-1")}
                        >
                          {serviceTitle(service)}
                        </a>
                      </li>
                    ))}
                  </ul>
                  {hasMoreServices ? (
                    <a
                      href="/#services"
                      onClick={(event) => goToSection("services", event)}
                      className={cn(linkClass, "mt-3 inline-block font-medium")}
                    >
                      مشاهده همه خدمات
                    </a>
                  ) : null}
                </>
              ) : (
                <a
                  href="/#services"
                  onClick={(event) => goToSection("services", event)}
                  className={linkClass}
                >
                  خدمات ما
                </a>
              )}
            </nav>

            <div>
              <FooterHeading>تماس با ما</FooterHeading>
              {channels.length > 0 ? (
                <ul className="space-y-3">
                  {channels.map((channel) => {
                    const Icon = CHANNEL_ICONS[channel.id];
                    const isExternal = channel.href.startsWith("http");
                    return (
                      <li key={channel.id}>
                        <a
                          href={channel.href}
                          target={isExternal ? "_blank" : undefined}
                          rel={isExternal ? "noopener noreferrer" : undefined}
                          className="group flex items-start gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          <span
                            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand/20 bg-brand/10 text-brand"
                            aria-hidden
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-xs text-muted-foreground">
                              {channel.label}
                            </span>
                            <span
                              className="mt-0.5 block truncate text-sm font-medium text-foreground transition-colors group-hover:text-brand"
                              dir="ltr"
                            >
                              {channel.value}
                            </span>
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <a
                  href="/#contact"
                  onClick={(event) => goToSection("contact", event)}
                  className={linkClass}
                >
                  فرم تماس با ما
                </a>
              )}
              <p className="mt-4 text-xs leading-6 text-muted-foreground">
                {CONTACT_HOURS_TEXT}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="text-center text-xs leading-6 text-muted-foreground sm:text-start">
            © {year} {COMPANY_INTRO_TITLE}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-end">
            {channels.length > 0 ? (
              <>
                <div className="flex items-center gap-2" aria-label="راه‌های ارتباطی">
                  {channels.map((channel) => (
                    <ChannelIconButton key={channel.id} channel={channel} />
                  ))}
                </div>
                <span className="hidden h-4 w-px bg-border/80 sm:block" aria-hidden />
              </>
            ) : null}

            <Link href="/login" className={cn(linkClass, "text-xs")}>
              ورود تیم
            </Link>
            <Link href="/portal/login" className={cn(linkClass, "text-xs")}>
              پورتال مشتری
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
