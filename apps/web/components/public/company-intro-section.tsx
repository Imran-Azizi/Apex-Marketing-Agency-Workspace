import { CompanyIntroCta } from "@/components/public/company-intro-cta";
import { PublicReveal } from "@/components/public/public-reveal";
import { COMPANY_INTRO_TITLE } from "@/lib/company";

function CompanyIntroTitle() {
  const words = COMPANY_INTRO_TITLE.trim().split(/\s+/);
  const brandWord = words.pop() ?? "";
  return (
    <>
      {words.join(" ")} <span className="text-brand">{brandWord}</span>
    </>
  );
}

export function CompanyIntroSection({
  description,
}: {
  description?: string | null;
}) {
  const text = String(description || "").trim();

  return (
    <section
      id="about"
      dir="rtl"
      className="relative scroll-mt-20 bg-transparent"
      aria-labelledby="company-intro-heading"
    >
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <PublicReveal delay={0}>
            <span className="mb-5 inline-block h-px w-12 bg-brand" aria-hidden />
          </PublicReveal>

          <PublicReveal delay={70}>
            <h2
              id="company-intro-heading"
              className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl"
            >
              <CompanyIntroTitle />
            </h2>
          </PublicReveal>

          {text ? (
            <PublicReveal delay={140}>
              <p className="mt-5 max-w-xl whitespace-pre-wrap text-pretty text-sm leading-8 text-muted-foreground sm:text-base sm:leading-9">
                {text}
              </p>
            </PublicReveal>
          ) : null}

          <PublicReveal delay={220} className="mt-8">
            <CompanyIntroCta />
          </PublicReveal>
        </div>
      </div>
    </section>
  );
}
