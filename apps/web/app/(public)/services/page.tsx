"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy route → home section (bookmark-safe). */
export default function ServicesRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/#services");
  }, [router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      در حال انتقال به بخش خدمات…
    </div>
  );
}
