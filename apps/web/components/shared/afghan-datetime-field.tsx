"use client";

import { useId } from "react";
import { AfghanDateField } from "@/components/shared/afghan-date-field";
import { Input } from "@/components/ui/input";
import { localTodayGregorian } from "@/lib/afghan-calendar";
import { cn } from "@/lib/utils";

/**
 * Date + time picker.
 * The date half is the Afghan Solar Hijri calendar.
 * The value stays a local `YYYY-MM-DDTHH:mm` string, the same shape as
 * `<input type="datetime-local">`, so existing API payloads are unchanged.
 */
interface AfghanDateTimeFieldProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Convert a stored ISO instant or local `YYYY-MM-DDTHH:mm` value into the
 * local wall-clock shape this field edits.
 */
export function toLocalDateTimeInputValue(
  value: string | Date | null | undefined,
): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const local = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(
      value.trim(),
    );
    if (local) return `${local[1]}T${local[2]}:${local[3]}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function splitDateTime(value: string): { date: string; time: string } {
  const normalized = toLocalDateTimeInputValue(value);
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(normalized);
  if (!match) return { date: "", time: "" };
  return {
    date: match[1],
    time: `${match[2]}:${match[3]}`,
  };
}

function todayGregorianInput(): string {
  const today = localTodayGregorian();
  return `${today.gy}-${pad2(today.gm)}-${pad2(today.gd)}`;
}

function sameDateTime(current: string, next: string): boolean {
  return (
    current === next ||
    current.startsWith(`${next}:`) ||
    current.startsWith(`${next}.`)
  );
}

export function AfghanDateTimeField({
  id,
  value,
  onChange,
  className,
  disabled = false,
  "aria-label": ariaLabel,
}: AfghanDateTimeFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const { date, time } = splitDateTime(value);

  function emit(nextDate: string, nextTime: string) {
    const clock = /^\d{2}:\d{2}$/.test(nextTime) ? nextTime : "";
    if (!nextDate) {
      if (!clock) {
        if (value) onChange("");
        return;
      }
    }
    const resolvedDate = nextDate || todayGregorianInput();
    const resolvedTime = clock || "00:00";
    const next = `${resolvedDate}T${resolvedTime}`;
    if (!sameDateTime(value, next)) onChange(next);
  }

  function changeDate(nextDate: string) {
    if (!nextDate) {
      if (value) onChange("");
      return;
    }
    emit(nextDate, time);
  }

  return (
    <div className={cn("flex min-w-0 items-start gap-2", className)}>
      <AfghanDateField
        id={fieldId}
        value={date}
        disabled={disabled}
        aria-label={ariaLabel ? `${ariaLabel} — تاریخ` : "تاریخ"}
        onChange={changeDate}
        className="min-w-0 flex-1"
      />
      <Input
        id={`${fieldId}-time`}
        type="time"
        dir="ltr"
        step={60}
        disabled={disabled}
        value={time}
        aria-label={ariaLabel ? `${ariaLabel} — ساعت` : "ساعت"}
        onChange={(event) => emit(date, event.target.value)}
        className="w-[7.25rem] shrink-0 text-start"
      />
    </div>
  );
}
