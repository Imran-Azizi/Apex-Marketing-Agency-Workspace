import { FooterNavBlock } from "@/components/layout/footer-nav-block";
import { PublicReveal } from "@/components/public/public-reveal";
import { COMPANY_INTRO_TITLE } from "@/lib/company";
import type { PublicContactInfo } from "@/lib/contact";
import { serviceTitle, type PublicService } from "@/lib/services";

const SERVICE_PREVIEW_LIMIT = 6;

function uniqueFooterServices(services: PublicService[]) {
  const seenTitles = new Set<string>();
  const out: PublicService[] = [];
  for (const service of services) {
    const title = serviceTitle(service).trim().toLowerCase();
    if (!title || seenTitles.has(title)) continue;
    seenTitles.add(title);
    out.push(service);
  }
  return out;
}

export function PublicFooter({
  initialServices,
  companyDescription,
}: {
  initialServices?: PublicService[] | null;
  /** Kept for layout compatibility; contact UI was removed from the footer. */
  initialContact?: PublicContactInfo | null;
  companyDescription?: string | null;
}) {
  const year = new Date().getFullYear();
  const services = uniqueFooterServices(initialServices || []);
  const publishedServices = services.slice(0, SERVICE_PREVIEW_LIMIT);
  const hasMoreServices = services.length > SERVICE_PREVIEW_LIMIT;
  const aboutText = String(companyDescription || "").trim();

  return (
    <footer
      className="relative border-t border-border/50 bg-gradient-to-b from-muted/30 via-muted/15 to-background [content-visibility:auto] [contain-intrinsic-size:auto_420px]"
      aria-label="پاورقی وب‌سایت"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-brand/50 to-transparent"
        aria-hidden
      />

      <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <PublicReveal>
          <FooterNavBlock
            publishedServices={publishedServices}
            hasMoreServices={hasMoreServices}
            aboutText={aboutText}
          />
        </PublicReveal>
      </div>

      <div className="border-t border-border/50 bg-background/60">
        <div className="mx-auto max-w-7xl px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-5 sm:pb-5 lg:px-8">
          <p className="text-center text-[11px] leading-5 tracking-wide text-muted-foreground sm:text-xs sm:leading-6">
            © {year} {COMPANY_INTRO_TITLE}
          </p>
        </div>
      </div>
    </footer>
  );
}
