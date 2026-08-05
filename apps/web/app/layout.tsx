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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa-AF" dir="rtl" suppressHydrationWarning>
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
