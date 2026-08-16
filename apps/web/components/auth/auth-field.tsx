"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input, type InputProps } from "@/components/ui/input";
import {
  PasswordInput,
  type PasswordInputProps,
} from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const AUTH_INPUT_CLASS =
  "h-12 rounded-xl border-border/80 bg-background/90 text-[15px] shadow-sm shadow-black/[0.03] transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground/65 focus-visible:border-brand/55 focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-0 dark:bg-background/70 dark:shadow-black/20";

export const AUTH_SUBMIT_CLASS =
  "h-12 rounded-xl text-[15px] font-semibold shadow-md shadow-brand/20 transition-all duration-200 hover:shadow-lg hover:shadow-brand/30 hover:brightness-[1.03] focus-visible:ring-brand/40 motion-safe:active:scale-[0.99]";

interface AuthFieldFrameProps {
  id: string;
  label: string;
  error?: string;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  dir?: React.HTMLAttributes<HTMLElement>["dir"];
  children: React.ReactNode;
}

function AuthFieldFrame({
  id,
  label,
  error,
  hint,
  icon: Icon,
  dir,
  children,
}: AuthFieldFrameProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[13px] font-medium text-foreground/90">
        {label}
      </Label>
      <div className="relative" dir={dir}>
        {Icon ? (
          <Icon
            className="pointer-events-none absolute start-3.5 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        ) : null}
        {children}
      </div>
      {hint ? (
        <p id={hintId} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

export interface AuthInputProps extends InputProps {
  label: string;
  error?: string;
  hint?: React.ReactNode;
  icon?: LucideIcon;
}

export const AuthInput = React.forwardRef<HTMLInputElement, AuthInputProps>(
  (
    { id, label, error, hint, icon: Icon, className, required, dir, ...props },
    ref,
  ) => {
    const fieldId = id ?? props.name ?? "field";
    const describedBy = [
      error ? `${fieldId}-error` : null,
      hint ? `${fieldId}-hint` : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

    return (
      <AuthFieldFrame
        id={fieldId}
        label={label}
        error={error}
        hint={hint}
        icon={Icon}
        dir={dir}
      >
        <Input
          {...props}
          ref={ref}
          id={fieldId}
          dir={dir}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          className={cn(
            AUTH_INPUT_CLASS,
            Icon ? "ps-11 pe-3.5" : "px-3.5",
            className,
          )}
        />
      </AuthFieldFrame>
    );
  },
);
AuthInput.displayName = "AuthInput";

export interface AuthPasswordFieldProps extends PasswordInputProps {
  label: string;
  error?: string;
  hint?: React.ReactNode;
  icon?: LucideIcon;
}

export const AuthPasswordField = React.forwardRef<
  HTMLInputElement,
  AuthPasswordFieldProps
>(
  (
    {
      id,
      label,
      error,
      hint,
      icon: Icon,
      className,
      required,
      dir = "ltr",
      ...props
    },
    ref,
  ) => {
    const fieldId = id ?? props.name ?? "password";
    const describedBy = [
      error ? `${fieldId}-error` : null,
      hint ? `${fieldId}-hint` : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

    return (
      <AuthFieldFrame
        id={fieldId}
        label={label}
        error={error}
        hint={hint}
        icon={Icon}
        dir={dir}
      >
        <PasswordInput
          {...props}
          ref={ref}
          id={fieldId}
          dir={dir}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          className={cn(
            AUTH_INPUT_CLASS,
            Icon ? "ps-11" : "ps-3.5",
            className,
          )}
        />
      </AuthFieldFrame>
    );
  },
);
AuthPasswordField.displayName = "AuthPasswordField";

export function AuthFormError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/10 px-3.5 py-3 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p className="leading-relaxed">{message}</p>
    </div>
  );
}

export function AuthSubmitButton({
  loading,
  loadingText,
  children,
  disabled,
  className,
  ...props
}: React.ComponentProps<typeof Button> & {
  loading?: boolean;
  loadingText?: React.ReactNode;
}) {
  return (
    <Button
      type="submit"
      variant="brand"
      isLoading={loading}
      loadingText={loadingText}
      disabled={disabled || loading}
      className={cn("w-full", AUTH_SUBMIT_CLASS, className)}
      {...props}
    >
      {children}
    </Button>
  );
}
