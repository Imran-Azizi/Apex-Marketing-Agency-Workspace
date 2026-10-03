"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import {
  LANDING_PREVIEW_DEVICES,
  formatLandingViewportLabel,
  landingPreviewWidth,
  setActiveLandingPreviewDevice,
  type LandingPreviewDevice,
} from "@/lib/landing-device-preview";
import { cn } from "@/lib/utils";

type LandingDevicePreviewContextValue = {
  device: LandingPreviewDevice;
  setDevice: (device: LandingPreviewDevice) => void;
  width: number;
  band: LandingPreviewDevice;
  viewportLabel: string;
};

const LandingDevicePreviewContext =
  createContext<LandingDevicePreviewContextValue | null>(null);

export function LandingDevicePreviewProvider({
  children,
  defaultDevice = "desktop",
  /** When false, do not override module visibility helpers. */
  syncModulePreview = true,
}: {
  children: ReactNode;
  defaultDevice?: LandingPreviewDevice;
  syncModulePreview?: boolean;
}) {
  const [device, setDeviceState] =
    useState<LandingPreviewDevice>(defaultDevice);
  const width = landingPreviewWidth(device);
  const band = device;

  useLayoutEffect(() => {
    if (!syncModulePreview) {
      setActiveLandingPreviewDevice(null, null);
      return;
    }
    setActiveLandingPreviewDevice(band, width);
    return () => setActiveLandingPreviewDevice(null, null);
  }, [band, width, syncModulePreview]);

  const setDevice = useCallback(
    (next: LandingPreviewDevice) => {
      const nextWidth = landingPreviewWidth(next);
      setDeviceState(next);
      if (syncModulePreview) {
        setActiveLandingPreviewDevice(next, nextWidth);
      }
    },
    [syncModulePreview],
  );

  const value = useMemo(
    () => ({
      device,
      setDevice,
      width,
      band,
      viewportLabel: formatLandingViewportLabel(width),
    }),
    [device, setDevice, width, band],
  );

  return (
    <LandingDevicePreviewContext.Provider value={value}>
      {children}
    </LandingDevicePreviewContext.Provider>
  );
}

export function useLandingDevicePreview() {
  const ctx = useContext(LandingDevicePreviewContext);
  if (!ctx) {
    return {
      device: "desktop" as LandingPreviewDevice,
      setDevice: (_device: LandingPreviewDevice) => undefined,
      width: landingPreviewWidth("desktop"),
      band: "desktop" as LandingPreviewDevice,
      viewportLabel: formatLandingViewportLabel(1440),
      enabled: false,
    };
  }
  return { ...ctx, enabled: true };
}

const DEVICE_ICONS = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
} as const;

export function LandingDevicePreviewToolbar({
  className,
}: {
  className?: string;
}) {
  const { device, setDevice } = useLandingDevicePreview();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border/70 bg-card p-1 shadow-sm",
        className,
      )}
      role="toolbar"
      aria-label="Device preview"
      dir="ltr"
    >
      {LANDING_PREVIEW_DEVICES.map((item) => {
        const active = device === item.id;
        const Icon = DEVICE_ICONS[item.id];
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setDevice(item.id)}
            aria-pressed={active}
            title={`${item.label} (${item.rangeLabel})`}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-colors",
              active
                ? "bg-brand text-brand-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            )}
          >
            <span>{item.label}</span>
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

/** Shared centered device frame used by the editor canvas. */
export function LandingDevicePreviewFrame({
  children,
  className,
  simulateBreakpoints = true,
}: {
  children: ReactNode;
  className?: string;
  /** Apply data-device-preview CSS simulation (editor). */
  simulateBreakpoints?: boolean;
}) {
  const { width, band, device } = useLandingDevicePreview();

  return (
    <div
      className={cn(
        "flex min-h-full w-full justify-center p-3 sm:p-5 [direction:ltr]",
        className,
      )}
    >
      <div
        dir="rtl"
        data-device-preview={simulateBreakpoints ? band : undefined}
        className={cn(
          "landing-device-frame shrink-0 overflow-hidden border border-border/70 bg-background shadow-md transition-[width] duration-300 ease-out",
          device === "mobile" &&
            "rounded-[1.75rem] shadow-lg ring-1 ring-black/5",
          device === "tablet" && "rounded-2xl",
          device === "desktop" && "rounded-2xl",
        )}
        style={{
          width,
          minWidth: width,
          maxWidth: width,
        }}
      >
        {children}
      </div>
    </div>
  );
}
