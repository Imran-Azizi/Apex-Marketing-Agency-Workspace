import { CompanyIntroCta } from "@/components/public/company-intro-cta";
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
      className="relative scroll-mt-20 border-t border-border/40 bg-transparent"
      aria-labelledby="company-intro-heading"
    >
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <span className="mb-5 h-px w-12 bg-brand animate-public-fade" aria-hidden />

          <h2
            id="company-intro-heading"
            className="animate-public-fade text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl"
            style={{ animationDelay: "70ms" }}
          >
            <CompanyIntroTitle />
          </h2>

          {text ? (
            <p
              className="mt-5 max-w-xl animate-public-fade whitespace-pre-wrap text-pretty text-sm leading-8 text-muted-foreground sm:text-base sm:leading-9"
              style={{ animationDelay: "140ms" }}
            >
              {text}
            </p>
          ) : null}

          <div className="mt-8 animate-public-fade" style={{ animationDelay: "220ms" }}>
            <CompanyIntroCta />
          </div>
        </div>
      </div>
    </section>
  );
}
