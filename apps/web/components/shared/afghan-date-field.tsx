"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
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
  afghanDatePlaceholder,
  currentAfghanYear,
  formatStoredDateAsAfghan,
  parseAfghanDateInput,
  resolveLocalTodayAfghan,
  toGregorianInputValue,
  type AfghanDate,
} from "@/lib/afghan-calendar";

/** How far before/after the current Afghan year the year list extends. */
const YEAR_WINDOW = 50;
const PANEL_WIDTH = 312;
const PANEL_GAP = 6;

interface AfghanDateFieldProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** Extra classes for the text input, e.g. to match neighbouring field heights. */
  inputClassName?: string;
  disabled?: boolean;
  "aria-label"?: string;
  placeholder?: string;
}

type PanelPosition = { top: number; left: number };

function sameAfghanDate(a: AfghanDate | null, b: AfghanDate | null): boolean {
  return Boolean(a && b && a.jy === b.jy && a.jm === b.jm && a.jd === b.jd);
}

function viewFromValue(value: string): AfghanDate {
  return afghanFromGregorianInput(value) ?? resolveLocalTodayAfghan();
}

function resolvePortalParent(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  // Always use document.body. Dialog content uses transform, which would
  // break position:fixed if the calendar were portaled into it.
  return document.body;
}

function computePosition(anchor: HTMLElement): PanelPosition {
  const rect = anchor.getBoundingClientRect();
  const width = Math.min(PANEL_WIDTH, window.innerWidth - 24);
  const estimatedHeight = 340;
  const left = Math.min(
    Math.max(12, rect.right - width),
    window.innerWidth - width - 12,
  );
  const below = rect.bottom + PANEL_GAP;
  const above = rect.top - PANEL_GAP - estimatedHeight;
  const top =
    below + estimatedHeight <= window.innerHeight - 12
      ? below
      : Math.max(12, above);
  return { top, left };
}

export function AfghanDateField({
  id,
  value,
  onChange,
  className,
  inputClassName,
  disabled = false,
  "aria-label": ariaLabel,
  placeholder,
}: AfghanDateFieldProps) {
  const resolvedPlaceholder = placeholder ?? afghanDatePlaceholder();
  const autoId = useId();
  const fieldId = id ?? autoId;
  const display = value ? formatStoredDateAsAfghan(value) : "";
  const committed = display === "—" ? "" : display;
  const [draft, setDraft] = useState(committed);
  const [invalid, setInvalid] = useState(false);
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<AfghanDate>(() => viewFromValue(value));
  const [position, setPosition] = useState<PanelPosition>({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const draftRef = useRef(committed);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const calendarPointer = useRef(false);
  draftRef.current = draft;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!focused) setDraft(committed);
  }, [committed, focused]);

  const selected = afghanFromGregorianInput(value);
  const today = resolveLocalTodayAfghan();
  const cells = useMemo(
    () => buildAfghanMonthGrid(view.jy, view.jm),
    [view.jy, view.jm],
  );

  const years = useMemo(() => {
    const list: number[] = [];
    const currentYear = currentAfghanYear();
    const start = Math.min(
      currentYear - YEAR_WINDOW,
      view.jy,
      selected?.jy ?? view.jy,
    );
    const end = Math.max(
      currentYear + YEAR_WINDOW,
      view.jy,
      selected?.jy ?? view.jy,
    );
    for (let year = start; year <= end; year += 1) list.push(year);
    return list;
  }, [selected?.jy, view.jy]);

  const updatePosition = useCallback(() => {
    if (!rootRef.current) return;
    setPosition(computePosition(rootRef.current));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onReposition = () => updatePosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) {
        calendarPointer.current = true;
        return;
      }
      setOpen(false);
      setFocused(false);
      commitDraft(draftRef.current);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      draftRef.current = committed;
      setDraft(committed);
      setInvalid(false);
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
    // commitDraft is stable enough via refs; committed is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, committed]);

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

  function openCalendar() {
    if (disabled) return;
    setView(viewFromValue(value));
    setOpen(true);
  }

  const weeks: Array<typeof cells> = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  const portalParent = mounted ? resolvePortalParent() : null;

  const panel =
    open && portalParent
      ? createPortal(
          <div
            id={`${fieldId}-calendar`}
            data-afghan-date-calendar=""
            data-radix-popover-content=""
            dir="rtl"
            role="dialog"
            aria-label="انتخاب تاریخ"
            ref={(node) => {
              panelRef.current = node;
              if (node) {
                node.style.setProperty("pointer-events", "auto", "important");
              }
            }}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: Math.min(PANEL_WIDTH, window.innerWidth - 24),
              zIndex: 200,
            }}
            className="rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg outline-none"
            onPointerDown={() => {
              calendarPointer.current = true;
            }}
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

            <div
              role="grid"
              aria-label={`${AFGHAN_MONTHS[view.jm - 1]} ${view.jy}`}
            >
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
                    const isSelected =
                      cell.inMonth && sameAfghanDate(cell, selected);
                    const isToday = sameAfghanDate(cell, today);
                    return (
                      <div
                        key={`${cell.jy}-${cell.jm}-${cell.jd}`}
                        role="gridcell"
                      >
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
                onClick={clearDate}
                className="h-8 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                پاک کردن
              </button>
            </div>
          </div>,
          portalParent,
        )
      : null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <input
        id={fieldId}
        dir="rtl"
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        disabled={disabled}
        placeholder={resolvedPlaceholder}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={`${fieldId}-calendar`}
        value={draft}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          const next = event.relatedTarget;
          const movedIntoCalendar =
            calendarPointer.current ||
            (next instanceof Node &&
              Boolean(panelRef.current?.contains(next)));
          calendarPointer.current = false;
          if (movedIntoCalendar || open) return;
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
            openCalendar();
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
          inputClassName,
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
      <button
        type="button"
        disabled={disabled}
        aria-label="باز کردن تقویم"
        aria-expanded={open}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => (open ? setOpen(false) : openCalendar())}
        className="absolute end-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Calendar className="size-4" />
      </button>
      {invalid ? (
        <p
          role="alert"
          className="pointer-events-none absolute top-full z-10 mt-0.5 text-[11px] leading-4 text-destructive"
        >
          تاریخ نامعتبر است
        </p>
      ) : null}
      {panel}
    </div>
  );
}
