import type { Metadata } from "next";
import { vazirmatn } from "@/lib/fonts";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ThemeToaster } from "@/components/providers/theme-toaster";
import { LoadingProviders } from "@/components/loading/loading-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "اپیکس ورک‌اسپیس",
  description: "سیستم مدیریت مشتری، پورتال، پروژه‌ها و هوش مصنوعی",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/brand/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/brand/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/favicon/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/favicon/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa-AF" dir="rtl" suppressHydrationWarning data-scroll-behavior="smooth">
      {/* suppressHydrationWarning: theme class + browser extensions may differ
          between server HTML and client hydration. */}
      <body
        className={`${vazirmatn.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <QueryProvider>
            <LoadingProviders />
            {children}
            <ThemeToaster />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
