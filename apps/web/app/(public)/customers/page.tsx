"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Bookmark-safe: section lives on the home page. */
export default function CustomersRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/#customers");
  }, [router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      در حال انتقال به بخش مشتریان ما…
    </div>
  );
}
