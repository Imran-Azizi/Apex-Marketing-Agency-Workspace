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

function AuthAtmosphere({ premium }: { premium?: boolean }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <div className="absolute inset-0 bg-[hsl(220_16%_97%)] dark:bg-[hsl(215_28%_8%)]" />
      <div
        className={cn(
          "absolute inset-0",
          premium
            ? "bg-[radial-gradient(1100px_circle_at_50%_-12%,hsl(var(--brand)/0.22),transparent_58%)] dark:bg-[radial-gradient(1000px_circle_at_50%_-10%,hsl(var(--brand)/0.18),transparent_55%)]"
            : "bg-[radial-gradient(900px_circle_at_50%_-20%,hsl(var(--brand)/0.18),transparent_55%)] dark:bg-[radial-gradient(900px_circle_at_50%_-18%,hsl(var(--brand)/0.16),transparent_52%)]",
        )}
      />
      <div className="absolute inset-0 bg-[radial-gradient(720px_circle_at_50%_118%,hsl(215_28%_17%/0.05),transparent_52%)] dark:bg-[radial-gradient(720px_circle_at_50%_118%,hsl(var(--brand)/0.07),transparent_55%)]" />
      {premium ? (
        <div className="absolute inset-0 bg-[radial-gradient(480px_circle_at_82%_18%,hsl(var(--brand)/0.08),transparent_60%)] dark:bg-[radial-gradient(480px_circle_at_82%_18%,hsl(var(--brand)/0.06),transparent_60%)]" />
      ) : null}
    </div>
  );
}

const NAV_CHIP =
  "rounded-2xl border border-border/60 bg-card/85 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.35)] backdrop-blur-md transition-all duration-200 hover:border-border hover:bg-card hover:shadow-[0_12px_28px_-16px_rgba(15,23,42,0.4)] dark:border-white/10 dark:bg-card/75 dark:shadow-[0_10px_28px_-16px_rgba(0,0,0,0.65)]";

export function AuthShell({
  audience,
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  const copy = getAuthAudienceCopy(audience);
  const heading = title ?? copy.title;
  const premium = audience === "portal-register";

  return (
    <div className="relative isolate min-h-dvh" dir="rtl">
      <AuthAtmosphere premium={premium} />

      <div className="absolute start-3 top-3 z-20 sm:start-5 sm:top-5">
        <ThemeToggle className={cn("h-10 w-10", NAV_CHIP)} />
      </div>
      <Link
        href="/"
        aria-label="بازگشت به خانه"
        className={cn(
          "absolute end-3 top-3 z-20 inline-flex h-10 items-center gap-2 px-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:end-5 sm:top-5",
          NAV_CHIP,
        )}
      >
        <Home className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">خانه</span>
      </Link>

      <div
        className={cn(
          "relative z-10 flex min-h-dvh items-center justify-center",
          premium
            ? "px-4 py-14 sm:px-6 sm:py-10"
            : "px-4 py-16 sm:px-6 sm:py-12",
        )}
      >
        <div
          className={cn(
            "w-full border border-border/65 bg-card/95",
            "motion-safe:animate-auth-rise",
            premium
              ? cn(
                  "max-w-[28.5rem] rounded-[1.5rem] px-5 py-5 shadow-[0_24px_56px_-26px_rgba(15,23,42,0.3),0_1px_0_0_rgba(255,255,255,0.65)_inset]",
                  "sm:max-w-[30rem] sm:px-7 sm:py-6",
                  "dark:border-white/10 dark:bg-card/92 dark:shadow-[0_28px_64px_-26px_rgba(0,0,0,0.75),0_1px_0_0_rgba(255,255,255,0.04)_inset]",
                )
              : cn(
                  "max-w-[22.5rem] rounded-3xl px-5 py-6 shadow-[0_20px_48px_-24px_rgba(15,23,42,0.28)]",
                  "sm:max-w-[23.5rem] sm:px-7 sm:py-7",
                  "dark:border-white/10 dark:bg-card/90 dark:shadow-[0_24px_56px_-24px_rgba(0,0,0,0.7)]",
                ),
          )}
        >
          <div className="flex flex-col items-center text-center">
            <Logo
              variant="mark"
              size={premium ? "md" : "xl"}
              className={premium ? undefined : "-my-1.5"}
              markClassName={
                premium ? "h-14 w-14 sm:h-[3.75rem] sm:w-[3.75rem]" : undefined
              }
            />
            {premium ? (
              <p className="mt-2 text-[10px] font-medium tracking-[0.14em] text-muted-foreground/90">
                {copy.eyebrow}
              </p>
            ) : null}
            <h1
              className={cn(
                "font-semibold leading-snug tracking-tight text-foreground",
                premium
                  ? "mt-1.5 text-[1.3rem] sm:text-[1.4rem]"
                  : "mt-3.5 text-[1.4rem] sm:mt-4 sm:text-[1.5rem]",
              )}
            >
              {heading}
            </h1>
            {description ? (
              <p
                className={cn(
                  "text-muted-foreground",
                  premium
                    ? "mt-1.5 max-w-[26rem] text-[12.5px] leading-5 sm:text-[13px] sm:leading-5"
                    : "mt-1.5 max-w-[18rem] text-sm leading-6",
                )}
              >
                {description}
              </p>
            ) : null}
          </div>

          <div className={cn(premium ? "mt-4 sm:mt-5" : "mt-5 sm:mt-6")}>
            {children}
          </div>

          {footer ? (
            <div className={cn(premium ? "mt-3.5" : "mt-4")}>{footer}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
