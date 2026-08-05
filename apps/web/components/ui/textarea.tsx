import * as React from "react";
import { cn, toEnglishDigits } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /**
   * When false, skip automatic Persian/Arabic → English digit conversion.
   * Default: true.
   */
  normalizeDigits?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, normalizeDigits = true, onChange, ...props }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (normalizeDigits) {
        const raw = event.target.value;
        const normalized = toEnglishDigits(raw);
        if (normalized !== raw) {
          event.target.value = normalized;
        }
      }
      onChange?.(event);
    };

    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
        onChange={handleChange}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
