import { ThemeToggle } from "@/components/layout/theme-toggle";

/** Shared chrome for auth screens — theme control without a full header. */
export function AuthThemeChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="absolute start-3 top-3 z-10 sm:start-4 sm:top-4">
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}
