import Link from "next/link";
import { Home } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import {
  getAuthAudienceCopy,
  type AuthAudience,
} from "@/components/auth/auth-audience";

interface AuthShellProps {
  audience: AuthAudience;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

function AuthAtmosphere() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <div className="absolute inset-0 bg-[hsl(220_16%_96%)] dark:bg-[hsl(215_28%_8%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_50%_-20%,hsl(var(--brand)/0.18),transparent_55%)] dark:bg-[radial-gradient(900px_circle_at_50%_-18%,hsl(var(--brand)/0.16),transparent_52%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(700px_circle_at_50%_120%,hsl(215_28%_17%/0.06),transparent_50%)] dark:bg-[radial-gradient(700px_circle_at_50%_120%,hsl(var(--brand)/0.06),transparent_55%)]" />
    </div>
  );
}

export function AuthShell({
  audience,
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  const copy = getAuthAudienceCopy(audience);
  const heading = title ?? copy.title;

  return (
    <div className="relative isolate min-h-dvh">
      <AuthAtmosphere />

      <div className="absolute start-3 top-3 z-20 sm:start-5 sm:top-5">
        <ThemeToggle className="rounded-xl border border-border/70 bg-card/80 shadow-sm backdrop-blur-md hover:bg-card" />
      </div>
      <Link
        href="/"
        aria-label="بازگشت به خانه"
        className="absolute end-3 top-3 z-20 inline-flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-card/80 px-3 text-sm text-muted-foreground shadow-sm backdrop-blur-md transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:end-5 sm:top-5"
      >
        <Home className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">خانه</span>
      </Link>

      <div className="relative z-10 flex min-h-dvh items-center justify-center px-4 py-16 sm:px-6 sm:py-12">
        <div
          className={cn(
            "w-full max-w-[22.5rem] rounded-3xl border border-border/70 bg-card/95 px-5 py-6 shadow-[0_20px_48px_-24px_rgba(15,23,42,0.28)]",
            "sm:max-w-[23.5rem] sm:px-7 sm:py-7",
            "dark:border-white/10 dark:bg-card/90 dark:shadow-[0_24px_56px_-24px_rgba(0,0,0,0.7)]",
            "motion-safe:animate-auth-rise",
          )}
        >
          <div className="flex flex-col items-center text-center">
            <Logo variant="mark" size="xl" className="-my-1.5" />
            <h1 className="mt-3.5 text-[1.4rem] font-semibold leading-snug tracking-tight text-foreground sm:mt-4 sm:text-[1.5rem]">
              {heading}
            </h1>
            {description ? (
              <p className="mt-1.5 max-w-[18rem] text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>

          <div className="mt-5 sm:mt-6">{children}</div>

          {footer ? <div className="mt-4">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
