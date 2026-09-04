"use client";

import * as React from "react";
import PhoneInput, { type Country, type Value } from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import en from "react-phone-number-input/locale/en.json";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";
import { toPhoneInputValue } from "@/lib/phone";
import { PhoneCountrySelect } from "@/components/shared/phone-country-select";

export type WhatsAppPhoneInputProps = {
  id?: string;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  required?: boolean;
  defaultCountry?: Country;
  className?: string;
  inputClassName?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

export function WhatsAppPhoneInput({
  id,
  value,
  onChange,
  onBlur,
  disabled,
  required,
  defaultCountry = "AF",
  className,
  inputClassName,
  ...aria
}: WhatsAppPhoneInputProps) {
  const displayValue = toPhoneInputValue(value) as Value | undefined;
  const invalid = aria["aria-invalid"] === true;

  return (
    <PhoneInput
      id={id}
      international
      countryCallingCodeEditable={false}
      defaultCountry={defaultCountry}
      flags={flags}
      labels={en}
      value={displayValue}
      onChange={(next) => onChange?.(next || "")}
      onBlur={onBlur}
      disabled={disabled}
      required={required}
      dir="ltr"
      countrySelectComponent={PhoneCountrySelect}
      className={cn(
        "whatsapp-phone-input flex w-full items-stretch overflow-hidden rounded-xl border bg-background/95 shadow-sm shadow-black/[0.025] transition-[border-color,box-shadow] duration-200",
        "hover:border-border focus-within:border-brand/55 focus-within:ring-2 focus-within:ring-brand/20",
        invalid
          ? "border-destructive/60 focus-within:border-destructive/70 focus-within:ring-destructive/20"
          : "border-border/70",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
      numberInputProps={{
        className: cn(
          "PhoneInputInput h-11 flex-1 border-0 bg-transparent px-3 text-sm shadow-none outline-none ring-0",
          "placeholder:text-muted-foreground/65 focus-visible:outline-none focus-visible:ring-0",
          "disabled:cursor-not-allowed",
          inputClassName,
        ),
        ...aria,
      }}
    />
  );
}
