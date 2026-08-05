"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input, type InputProps } from "@/components/ui/input";

export interface PasswordInputProps extends Omit<InputProps, "type"> {
  /** Optional override for show/hide button labels (defaults to Dari). */
  showLabel?: string;
  hideLabel?: string;
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      className,
      disabled,
      showLabel = "نمایش رمز عبور",
      hideLabel = "مخفی کردن رمز عبور",
      ...props
    },
    ref,
  ) => {
    const [visible, setVisible] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    const toggleVisibility = (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const input = inputRef.current;
      const selectionStart = input?.selectionStart ?? null;
      const selectionEnd = input?.selectionEnd ?? null;

      setVisible((prev) => !prev);

      // Keep focus and caret position after the type switch.
      requestAnimationFrame(() => {
        if (!input) return;
        input.focus();
        if (selectionStart != null && selectionEnd != null) {
          try {
            input.setSelectionRange(selectionStart, selectionEnd);
          } catch {
            // Some browsers reject setSelectionRange on certain input modes.
          }
        }
      });
    };

    return (
      <div className="relative">
        <Input
          ref={setRefs}
          type={visible ? "text" : "password"}
          disabled={disabled}
          className={cn("pe-10", className)}
          {...props}
        />
        <button
          type="button"
          tabIndex={0}
          disabled={disabled}
          onClick={toggleVisibility}
          onMouseDown={(event) => {
            // Prevent the input from losing focus before toggle.
            event.preventDefault();
          }}
          aria-label={visible ? hideLabel : showLabel}
          title={visible ? hideLabel : showLabel}
          className={cn(
            "absolute inset-y-0 end-0 z-10 inline-flex w-10 items-center justify-center rounded-e-md text-muted-foreground transition-colors",
            "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
