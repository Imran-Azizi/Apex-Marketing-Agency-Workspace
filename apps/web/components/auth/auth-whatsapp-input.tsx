"use client";

import * as React from "react";
import type { Country } from "react-phone-number-input";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";
import { WhatsAppPhoneInput } from "@/components/shared/whatsapp-phone-input";
import { AUTH_INPUT_CLASS } from "@/components/auth/auth-field";

export type AuthWhatsAppInputProps = {
  id: string;
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  hint?: React.ReactNode;
  disabled?: boolean;
  required?: boolean;
  defaultCountry?: Country;
};

export function AuthWhatsAppInput({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
  disabled,
  required,
  defaultCountry,
}: AuthWhatsAppInputProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-[12.5px] font-medium text-foreground/90">
        {label}
      </Label>
      <WhatsAppPhoneInput
        id={id}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        required={required}
        defaultCountry={defaultCountry}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
          undefined
        }
        inputClassName={cn(AUTH_INPUT_CLASS, "h-11 rounded-none border-0 shadow-none")}
        className="h-11 rounded-xl"
      />
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
