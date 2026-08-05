"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

export function ThemeToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      richColors
      position="top-left"
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      toastOptions={{
        classNames: {
          toast: "font-sans",
        },
      }}
    />
  );
}
