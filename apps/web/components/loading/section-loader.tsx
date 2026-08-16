import { cn } from "@/lib/utils";
import { Spinner } from "@/components/loading/spinner";
import { Logo } from "@/components/brand/logo";

interface SectionLoaderProps {
  label?: string;
  className?: string;
  /** Compact inline variant for cards/modals */
  compact?: boolean;
}

/** Centered section-level loader for panels and async regions. */
export function SectionLoader({
  label = "در حال بارگذاری...",
  className,
  compact = false,
}: SectionLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        compact ? "py-8" : "min-h-[180px] py-12",
        className,
      )}
    >
      <div className="relative flex h-12 w-12 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-brand/20" />
        <span className="absolute inset-1 animate-ping rounded-full bg-brand/10 [animation-duration:1.6s]" />
        <Spinner size="md" className="relative text-brand" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

interface GlobalPageLoaderProps {
  label?: string;
  className?: string;
}

/** Full-viewport page loader used as a Suspense / auth fallback. */
export function GlobalPageLoader({
  label = "در حال آماده‌سازی...",
  className,
}: GlobalPageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-[50vh] w-full flex-col items-center justify-center gap-4 bg-background",
        className,
      )}
    >
      <Logo variant="mark" size="lg" />
      <div className="h-1 w-32 overflow-hidden rounded-full bg-secondary">
        <div className="h-full w-1/3 animate-progress-indeterminate rounded-full bg-brand" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/** Overlay loader for modals and dialogs. */
export function ModalLoader({
  label = "در حال بارگذاری...",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex min-h-[160px] flex-col items-center justify-center gap-3 py-10",
        className,
      )}
    >
      <Spinner size="md" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
