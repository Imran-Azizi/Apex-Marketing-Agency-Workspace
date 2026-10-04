"use client";

import { cn } from "@/lib/utils";
import { sanitizeRichText } from "@/lib/rich-text";

/**
 * Safely renders stored service (or similar) rich-text HTML.
 * Legacy plain-text descriptions are escaped and shown with line breaks.
 * Images/videos are sanitized and styled via `.rich-text-content` CSS.
 */
export function RichTextContent({
  value,
  className,
  dir = "rtl",
}: {
  value: string | null | undefined;
  className?: string;
  dir?: "rtl" | "ltr";
}) {
  const html = sanitizeRichText(value);
  if (!html) return null;

  return (
    <div
      dir={dir}
      className={cn(
        "rich-text-content prose prose-sm max-w-none text-muted-foreground",
        "prose-headings:font-semibold prose-headings:text-foreground",
        "prose-p:my-2 prose-p:leading-8",
        "prose-a:text-brand prose-a:underline prose-a:underline-offset-2",
        "prose-blockquote:border-s-2 prose-blockquote:border-border prose-blockquote:ps-3",
        "prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5",
        "prose-img:my-0 prose-video:my-0",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
