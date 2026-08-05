import * as React from "react";
import { cn, toEnglishDigits } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * When false, skip automatic Persian/Arabic → English digit conversion.
   * Default: true for text-like inputs.
   */
  normalizeDigits?: boolean;
}

const SKIP_NORMALIZE_TYPES = new Set([
  "checkbox",
  "radio",
  "file",
  "color",
  "range",
  "date",
  "datetime-local",
  "month",
  "time",
  "week",
  "hidden",
]);

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, normalizeDigits = true, onChange, ...props }, ref) => {
    const shouldNormalize =
      normalizeDigits && (!type || !SKIP_NORMALIZE_TYPES.has(type));

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (shouldNormalize) {
        const raw = event.target.value;
        const normalized = toEnglishDigits(raw);
        if (normalized !== raw) {
          event.target.value = normalized;
        }
      }
      onChange?.(event);
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
        onChange={handleChange}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
