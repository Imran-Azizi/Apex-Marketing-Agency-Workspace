import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  description?: string;
  className?: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: React.ReactNode;
}

/** Consistent error surface for failed queries and mutations. */
export function ErrorState({
  title = "مشکلی پیش آمد",
  description = "دوباره تلاش کنید. اگر مشکل ادامه داشت با پشتیبانی تماس بگیرید.",
  className,
  onRetry,
  retryLabel = "تلاش مجدد",
  action,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      dir="rtl"
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-destructive/30 bg-destructive/5 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {(onRetry || action) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {onRetry ? (
            <Button type="button" variant="outline" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" />
              {retryLabel}
            </Button>
          ) : null}
          {action}
        </div>
      )}
    </div>
  );
}
