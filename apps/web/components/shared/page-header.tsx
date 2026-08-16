import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
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
  inline = false,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-start sm:justify-between",
        inline &&
          "flex-row items-center justify-between gap-2 sm:items-start sm:gap-3",
        className,
      )}
    >
      <div className="min-w-0 flex-1 text-start">
        <h1
          className={cn(
            "break-words text-lg font-bold tracking-tight text-foreground sm:text-2xl",
            inline && "text-base leading-snug sm:text-2xl",
          )}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className={cn(
              "mt-0.5 break-words text-sm text-muted-foreground",
              inline && "truncate text-xs sm:mt-0.5 sm:text-sm sm:whitespace-normal",
            )}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div
          className={cn(
            "flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end",
            inline && "w-auto",
          )}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
