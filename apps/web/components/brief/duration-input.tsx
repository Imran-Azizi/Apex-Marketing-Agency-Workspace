"use client";

import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDurationLabel } from "@/lib/upload";

const PRESETS: { label: string; seconds: number }[] = [
  { label: "۱۵ ثانیه", seconds: 15 },
  { label: "۳۰ ثانیه", seconds: 30 },
  { label: "۴۵ ثانیه", seconds: 45 },
  { label: "۱ دقیقه", seconds: 60 },
  { label: "۱:۳۰", seconds: 90 },
  { label: "۲ دقیقه", seconds: 120 },
  { label: "۵ دقیقه", seconds: 300 },
];

const MAX_DURATION_SEC = 30 * 60;

type DurationInputProps = {
  valueSec: number;
  onChange: (seconds: number) => void;
  className?: string;
  hideLabel?: boolean;
};

export function DurationInput({ valueSec, onChange, className, hideLabel }: DurationInputProps) {
  const matchedPreset = PRESETS.find((p) => p.seconds === valueSec);
  const [customMode, setCustomMode] = useState(!matchedPreset && valueSec > 0);
  const [minutes, setMinutes] = useState(() => Math.floor((valueSec || 0) / 60));
  const [seconds, setSeconds] = useState(() => (valueSec || 0) % 60);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => formatDurationLabel(valueSec || 0), [valueSec]);

  function applyTotal(total: number) {
    if (!Number.isFinite(total) || total <= 0) {
      setError("مدت باید بیشتر از صفر باشد.");
      return;
    }
    if (total > MAX_DURATION_SEC) {
      setError("حداکثر مدت مجاز ۳۰ دقیقه است.");
      return;
    }
    setError(null);
    onChange(Math.round(total));
  }

  function selectPreset(sec: number) {
    setCustomMode(false);
    setMinutes(Math.floor(sec / 60));
    setSeconds(sec % 60);
    applyTotal(sec);
  }

  function enableCustom() {
    setCustomMode(true);
    setMinutes(Math.floor((valueSec || 0) / 60));
    setSeconds((valueSec || 0) % 60);
  }

  function commitCustom(nextMin: number, nextSec: number) {
    const m = Math.max(0, Math.min(30, Math.floor(nextMin) || 0));
    const s = Math.max(0, Math.min(59, Math.floor(nextSec) || 0));
    setMinutes(m);
    setSeconds(s);
    applyTotal(m * 60 + s);
  }

  return (
    <div className={cn("space-y-3 sm:col-span-2", className)}>
      {!hideLabel && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>مدت ویدیو</Label>
          <span className="text-xs font-medium text-muted-foreground">{summary}</span>
        </div>
      )}
      {hideLabel && (
        <div className="flex justify-end">
          <span className="text-xs font-medium text-muted-foreground">{summary}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.seconds}
            type="button"
            size="sm"
            variant={!customMode && valueSec === p.seconds ? "brand" : "outline"}
            className="h-8 rounded-md px-3 text-xs"
            onClick={() => selectPreset(p.seconds)}
          >
            {p.label}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={customMode ? "brand" : "outline"}
          className="h-8 rounded-md px-3 text-xs"
          onClick={enableCustom}
        >
          سفارشی
        </Button>
      </div>

      {customMode && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">دقیقه</Label>
            <Input
              dir="ltr"
              type="number"
              min={0}
              max={30}
              inputMode="numeric"
              value={Number.isFinite(minutes) ? minutes : 0}
              onChange={(e) => commitCustom(Number(e.target.value), seconds)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">ثانیه</Label>
            <Input
              dir="ltr"
              type="number"
              min={0}
              max={59}
              inputMode="numeric"
              value={Number.isFinite(seconds) ? seconds : 0}
              onChange={(e) => commitCustom(minutes, Number(e.target.value))}
            />
          </div>
          <p className="col-span-2 text-xs text-muted-foreground">
            می‌توانید ترکیبی از دقیقه و ثانیه وارد کنید (مثال: ۲ دقیقه و ۳۰ ثانیه).
          </p>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
