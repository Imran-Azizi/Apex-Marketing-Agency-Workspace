"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Bookmark-safe: section lives on the home page. */
export default function ContactRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/#contact");
  }, [router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      در حال انتقال به بخش تماس با ما…
    </div>
  );
}
