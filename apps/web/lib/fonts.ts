import { Vazirmatn } from "next/font/google";

export const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-vazirmatn",
  display: "swap",
  preload: true,
  fallback: ["Tahoma", "Arial", "sans-serif"],
  adjustFontFallback: true,
});
