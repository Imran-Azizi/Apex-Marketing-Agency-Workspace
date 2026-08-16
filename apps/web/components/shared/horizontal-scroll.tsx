import * as React from "react";
import { cn } from "@/lib/utils";

type HorizontalScrollProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Show a bordered card-style frame around the scroll area. Default true. */
  bordered?: boolean;
  /** Optional minimum width applied to the inner content track. */
  minWidth?: string | number;
  /** Extra classes for the scrollable viewport. */
  viewportClassName?: string;
};

/**
 * Reusable horizontal scroll frame for wide tables and data lists.
 * Keeps page vertical scroll intact while enabling polished, touch-friendly
 * horizontal overflow on small screens.
 */
export function HorizontalScroll({
  children,
  className,
  bordered = true,
  minWidth,
  viewportClassName,
  ...props
}: HorizontalScrollProps) {
  return (
    <div
      className={cn(
        "max-w-full min-w-0",
        bordered && "overflow-hidden rounded-lg border bg-card",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "apex-h-scroll w-full max-w-full overflow-x-auto overscroll-x-contain",
          viewportClassName,
        )}
      >
        {minWidth != null ? (
          <div
            className="min-w-0"
            style={{
              minWidth:
                typeof minWidth === "number" ? `${minWidth}px` : minWidth,
            }}
          >
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
