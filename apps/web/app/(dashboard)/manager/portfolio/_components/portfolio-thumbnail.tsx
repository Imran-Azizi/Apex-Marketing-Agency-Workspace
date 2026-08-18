"use client";

import { Film } from "lucide-react";
import { cn } from "@/lib/utils";

export function PortfolioThumbnail({
  thumbnailUrl,
  title,
  onPreview,
}: {
  thumbnailUrl?: string | null;
  title: string;
  onPreview: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPreview}
      aria-label={`مشاهده ${title}`}
      className="group/thumb relative block aspect-video w-full overflow-hidden bg-[#0c1118] text-start"
    >
      {thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt=""
          className={cn(
            "h-full w-full object-cover transition-transform duration-500",
            "motion-safe:group-hover/thumb:scale-[1.04]",
          )}
        />
      ) : (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#141a22] via-[#10151c] to-brand/20"
          aria-hidden
        >
          <Film className="h-7 w-7 text-brand/80" />
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent"
        aria-hidden
      />
    </button>
  );
}
