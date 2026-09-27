"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AFGHAN_MONTHS,
  AFGHAN_WEEKDAYS_SHORT,
  addAfghanMonths,
  afghanFromGregorianInput,
  buildAfghanMonthGrid,
  formatAfghanParts,
  formatStoredDateAsAfghan,
  localTodayAfghan,
  parseAfghanDateInput,
  toGregorianInputValue,
  type AfghanDate,
} from "@/lib/afghan-calendar";

const YEAR_START = 1350;
const YEAR_END = 1450;

interface AfghanDateFieldProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
  placeholder?: string;
}

function sameAfghanDate(a: AfghanDate | null, b: AfghanDate | null): boolean {
  return Boolean(a && b && a.jy === b.jy && a.jm === b.jm && a.jd === b.jd);
}

function viewFromValue(value: string): AfghanDate {
  return (
    afghanFromGregorianInput(value) ??
    localTodayAfghan() ?? { jy: 1405, jm: 1, jd: 1 }
  );
}

export function AfghanDateField({
  id,
  value,
  onChange,
  className,
  disabled = false,
  "aria-label": ariaLabel,
  placeholder = "1405 سنبله 01",
}: AfghanDateFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const display = value ? formatStoredDateAsAfghan(value) : "";
  const committed = display === "—" ? "" : display;
  const [draft, setDraft] = useState(committed);
  const [invalid, setInvalid] = useState(false);
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<AfghanDate>(() => viewFromValue(value));
  const draftRef = useRef(committed);
  const calendarPointer = useRef(false);
  draftRef.current = draft;

  useEffect(() => {
    if (!focused) setDraft(committed);
  }, [committed, focused]);

  const selected = afghanFromGregorianInput(value);
  const today = localTodayAfghan();
  const cells = useMemo(
    () => buildAfghanMonthGrid(view.jy, view.jm),
    [view.jy, view.jm],
  );

  const years = useMemo(() => {
    const list: number[] = [];
    const start = Math.min(YEAR_START, view.jy, selected?.jy ?? view.jy);
    const end = Math.max(YEAR_END, view.jy, selected?.jy ?? view.jy);
    for (let year = start; year <= end; year += 1) list.push(year);
    return list;
  }, [selected?.jy, view.jy]);

  function commitDraft(text: string) {
    const trimmed = text.trim();
    if (trimmed === committed) {
      draftRef.current = committed;
      setDraft(committed);
      setInvalid(false);
      return;
    }
    if (!trimmed) {
      draftRef.current = "";
      setDraft("");
      setInvalid(false);
      if (value) onChange("");
      return;
    }
    const parsed = parseAfghanDateInput(trimmed);
    const iso = parsed
      ? toGregorianInputValue(parsed.jy, parsed.jm, parsed.jd)
      : null;
    if (!parsed || !iso) {
      draftRef.current = committed;
      setDraft(committed);
      setInvalid(true);
      toast.error("تاریخ نامعتبر است");
      return;
    }
    const formatted = formatAfghanParts(parsed.jy, parsed.jm, parsed.jd);
    draftRef.current = formatted;
    setDraft(formatted);
    setInvalid(false);
    if (iso !== value) onChange(iso);
  }

  function selectDay(jy: number, jm: number, jd: number) {
    const iso = toGregorianInputValue(jy, jm, jd);
    if (!iso) {
      toast.error("تاریخ نامعتبر است");
      return;
    }
    const formatted = formatAfghanParts(jy, jm, jd);
    draftRef.current = formatted;
    setDraft(formatted);
    setFocused(false);
    setInvalid(false);
    if (iso !== value) onChange(iso);
    setOpen(false);
  }

  function clearDate() {
    draftRef.current = "";
    setDraft("");
    setInvalid(false);
    setFocused(false);
    if (value) onChange("");
    setOpen(false);
  }

  function openCalendar(next: boolean) {
    if (next) {
      setView(viewFromValue(value));
      setOpen(true);
      return;
    }
    setOpen(false);
    if (document.activeElement?.id === fieldId) return;

    const text = draftRef.current.trim();
    if (!text) {
      draftRef.current = "";
      setDraft("");
      setInvalid(false);
      setFocused(false);
      if (value) onChange("");
      return;
    }
    if (text === committed) {
      setInvalid(false);
      setFocused(false);
      return;
    }

    const parsed = parseAfghanDateInput(text);
    const iso = parsed
      ? toGregorianInputValue(parsed.jy, parsed.jm, parsed.jd)
      : null;
    if (parsed && iso) {
      const formatted = formatAfghanParts(parsed.jy, parsed.jm, parsed.jd);
      draftRef.current = formatted;
      setDraft(formatted);
      setInvalid(false);
      setFocused(false);
      if (iso !== value) onChange(iso);
      return;
    }

    draftRef.current = committed;
    setDraft(committed);
    setInvalid(false);
    setFocused(false);
  }

  const weeks: Array<typeof cells> = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  return (
    <Popover.Root open={open} onOpenChange={openCalendar}>
      <div className={cn("relative", className)}>
        <input
          id={fieldId}
          dir="rtl"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={`${fieldId}-calendar`}
          value={draft}
          onFocus={() => setFocused(true)}
          onBlur={(event) => {
            const next = event.relatedTarget;
            const calendar = document.getElementById(`${fieldId}-calendar`);
            const movedIntoCalendar =
              calendarPointer.current ||
              (next instanceof Node && Boolean(calendar?.contains(next)));
            calendarPointer.current = false;
            if (movedIntoCalendar) return;
            setFocused(false);
            commitDraft(event.currentTarget.value);
          }}
          onChange={(event) => {
            draftRef.current = event.target.value;
            setInvalid(false);
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && !open) {
              event.preventDefault();
              openCalendar(true);
            }
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft(event.currentTarget.value);
              setOpen(false);
            }
            if (event.key === "Escape") {
              draftRef.current = committed;
              setDraft(committed);
              setInvalid(false);
              setOpen(false);
            }
          }}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background py-2 ps-3 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            value ? "pe-16" : "pe-10",
            invalid && "border-destructive focus-visible:ring-destructive",
          )}
        />
        {value ? (
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            aria-label="پاک کردن تاریخ"
            onPointerDown={(event) => event.preventDefault()}
            onClick={clearDate}
            className="absolute end-8 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="باز کردن تقویم"
            onPointerDown={(event) => event.preventDefault()}
            className="absolute end-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Calendar className="size-4" />
          </button>
        </Popover.Trigger>
        {invalid ? (
          <p
            role="alert"
            className="pointer-events-none absolute top-full z-10 mt-0.5 text-[11px] leading-4 text-destructive"
          >
            تاریخ نامعتبر است
          </p>
        ) : null}
      </div>

      <Popover.Portal>
        <Popover.Content
          id={`${fieldId}-calendar`}
          dir="rtl"
          align="start"
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onPointerDown={() => {
            calendarPointer.current = true;
          }}
          className="z-[80] w-[min(19.5rem,calc(100vw-1.5rem))] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg outline-none"
        >
          <div className="mb-2 flex items-center gap-1">
            <button
              type="button"
              aria-label="ماه قبل"
              onClick={() =>
                setView((current) => ({
                  ...current,
                  ...addAfghanMonths(current.jy, current.jm, -1),
                }))
              }
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="size-4" />
            </button>
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-1">
              <select
                aria-label="ماه"
                value={view.jm}
                onChange={(event) =>
                  setView((current) => ({
                    ...current,
                    jm: Number(event.target.value),
                  }))
                }
                className="h-8 min-w-0 rounded-md border border-input bg-background px-2 text-sm"
              >
                {AFGHAN_MONTHS.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                aria-label="سال"
                value={view.jy}
                onChange={(event) =>
                  setView((current) => ({
                    ...current,
                    jy: Number(event.target.value),
                  }))
                }
                className="h-8 min-w-0 rounded-md border border-input bg-background px-2 text-sm tabular-nums"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              aria-label="ماه بعد"
              onClick={() =>
                setView((current) => ({
                  ...current,
                  ...addAfghanMonths(current.jy, current.jm, 1),
                }))
              }
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
            </button>
          </div>

          <div role="grid" aria-label={`${AFGHAN_MONTHS[view.jm - 1]} ${view.jy}`}>
            <div role="row" className="mb-1 grid grid-cols-7">
              {AFGHAN_WEEKDAYS_SHORT.map((label) => (
                <div
                  key={label}
                  role="columnheader"
                  className="flex h-8 items-center justify-center text-[11px] font-medium text-muted-foreground"
                >
                  {label}
                </div>
              ))}
            </div>
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} role="row" className="grid grid-cols-7">
                {week.map((cell) => {
                  const isSelected = cell.inMonth && sameAfghanDate(cell, selected);
                  const isToday = sameAfghanDate(cell, today);
                  return (
                    <div key={`${cell.jy}-${cell.jm}-${cell.jd}`} role="gridcell">
                      <button
                        type="button"
                        onClick={() => selectDay(cell.jy, cell.jm, cell.jd)}
                        className={cn(
                          "mx-auto flex size-8 items-center justify-center rounded-md text-sm tabular-nums transition-colors",
                          cell.inMonth
                            ? "text-foreground"
                            : "text-muted-foreground/45",
                          isSelected
                            ? "bg-primary font-semibold text-primary-foreground"
                            : "hover:bg-accent",
                          isToday && !isSelected && "ring-1 ring-primary",
                        )}
                      >
                        {cell.jd}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/70 pt-2">
            <button
              type="button"
              onClick={() => {
                if (!today) return;
                setView(today);
                selectDay(today.jy, today.jm, today.jd);
              }}
              className="h-8 rounded-md px-2 text-xs font-medium text-foreground hover:bg-accent"
            >
              امروز
            </button>
            <button
              type="button"
              onClick={() => {
                clearDate();
                setOpen(false);
              }}
              className="h-8 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              پاک کردن
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
