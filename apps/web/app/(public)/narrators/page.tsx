"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy route → home section (bookmark-safe). */
export default function NarratorsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/#narrators");
  }, [router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      در حال انتقال به بخش نمونه صدا…
    </div>
  );
}
