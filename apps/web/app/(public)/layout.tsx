import { PublicHeader } from "@/components/layout/public-header";
import { Logo } from "@/components/brand/logo";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const year = new Date().getFullYear();

  return (
    <div className="public-dot-pattern relative flex min-h-screen flex-col overflow-x-hidden">
      <PublicHeader />
      <main className="relative flex-1">{children}</main>
      <footer className="relative border-t border-border/60 bg-muted/25">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-8 text-center sm:flex-row sm:text-start sm:px-6 lg:px-8">
          <Logo size="sm" wordmarkClassName="text-foreground" />
          <p className="text-sm text-muted-foreground">
            © {year} اپیکس ورک‌اسپیس — تولید محتوای حرفه‌ای
          </p>
        </div>
      </footer>
    </div>
  );
}
