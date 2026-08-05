import { PublicHeader } from "@/components/layout/public-header";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border/60 bg-muted/20">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-8 text-center sm:flex-row sm:text-start sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-bold text-brand-foreground">
              ا
            </div>
            <span className="text-sm font-semibold text-foreground">اپیکس</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {year} اپیکس ورک‌اسپیس — تولید محتوای حرفه‌ای
          </p>
        </div>
      </footer>
    </div>
  );
}
