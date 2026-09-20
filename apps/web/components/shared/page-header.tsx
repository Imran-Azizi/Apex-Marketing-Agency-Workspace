import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  /** Extra classes for the subtitle (e.g. hide on mobile: `hidden sm:block`). */
  subtitleClassName?: string;
  /**
   * Keep title/subtitle and actions on one horizontal row on small screens
   * (space-between, vertically centered) instead of stacking.
   */
  inline?: boolean;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
  subtitleClassName,
  inline = false,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 flex min-w-0 max-w-full gap-3 sm:mb-8",
        inline
          ? "flex-row items-center justify-between"
          : "flex-col sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 flex-1 text-start">
        <h1
          className={cn(
            "break-words text-lg font-bold tracking-tight text-foreground sm:text-2xl",
            inline &&
              "truncate text-base leading-snug sm:whitespace-normal sm:break-words sm:text-2xl",
          )}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className={cn(
              "mt-0.5 break-words text-sm text-muted-foreground",
              inline &&
                "truncate text-xs sm:mt-0.5 sm:text-sm sm:whitespace-normal",
              subtitleClassName,
            )}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div
          className={cn(
            "flex shrink-0 items-center gap-2",
            inline
              ? "w-auto max-w-[58%] justify-end sm:max-w-none"
              : "w-full flex-wrap sm:w-auto sm:justify-end",
          )}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
