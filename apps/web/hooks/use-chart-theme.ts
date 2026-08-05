"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  getBrandColor,
  getChartAxisColor,
  getChartGridColor,
  getChartPalette,
} from "@/lib/theme-colors";

export function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const [palette, setPalette] = useState(getChartPalette);
  const [grid, setGrid] = useState(getChartGridColor);
  const [axis, setAxis] = useState(getChartAxisColor);
  const [brand, setBrand] = useState(getBrandColor);

  useEffect(() => {
    // Re-read after theme class settles on <html>
    const frame = requestAnimationFrame(() => {
      setPalette(getChartPalette());
      setGrid(getChartGridColor());
      setAxis(getChartAxisColor());
      setBrand(getBrandColor());
    });
    return () => cancelAnimationFrame(frame);
  }, [resolvedTheme]);

  return { palette, grid, axis, brand, isDark: resolvedTheme === "dark" };
}
